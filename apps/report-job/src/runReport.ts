import type { BiweeklyReportRequestedV1 } from "@nominate/contracts";
import type {
  NominationItem,
  ReportExecutionItem,
  Winner,
  WinnerDmDelivery,
} from "@nominate/domain";
import { tallyWinners } from "@nominate/domain";
import type { Logger } from "@nominate/observability";
import type {
  NominationRepository,
  ReportRepository,
} from "@nominate/persistence";
import {
  buildEmptyPeriodMessage,
  buildReportMessage,
  buildWinnerDm,
  type SlackClient,
} from "@nominate/slack";

// docs/04 §Report Lambda + docs/10 §Aggregation, §Public message, §Winner DMs.
// Idempotency is anchored to the REPORT_EXECUTION row: PENDING → PUBLISHED →
// per-winner DMs. A retry that lands after PUBLISHED must never re-post the
// public message; a DM failure must not roll back publication (docs/02
// §Publication rules).

export interface RunReportDeps {
  nominations: NominationRepository;
  reports: ReportRepository;
  slack: SlackClient;
  recognitionChannelId: string;
  logger: Logger;
  now: () => number;
}

export async function runReport(
  event: BiweeklyReportRequestedV1,
  deps: RunReportDeps,
): Promise<void> {
  const log = deps.logger.child({
    correlationId: event.executionKey,
    workspaceId: event.workspaceId,
    eventType: event.eventType,
  });

  const periodStartEpochMs = Date.parse(event.periodStart);
  const periodEndEpochMs = Date.parse(event.periodEnd);
  if (
    !Number.isFinite(periodStartEpochMs) ||
    !Number.isFinite(periodEndEpochMs) ||
    periodEndEpochMs <= periodStartEpochMs
  ) {
    throw new Error(
      `Invalid report period: ${event.periodStart} -> ${event.periodEnd}`,
    );
  }

  // Compute the query window from the scheduled periodStart/periodEnd — never
  // from any individual nomination's reportPeriodStart stamp, which anchors on
  // epoch multiples and drifts by 1 hour across DST.
  const nominations = await deps.nominations.queryByPeriod({
    workspaceId: event.workspaceId,
    periodStartEpochMs,
    periodEndEpochMs,
  });

  const winners = tallyWinners(nominations);
  const countsBySlackId: Record<string, number> = {};
  for (const nomination of nominations) {
    countsBySlackId[nomination.recipientSlackId] =
      (countsBySlackId[nomination.recipientSlackId] ?? 0) + 1;
  }

  const existing = await deps.reports.getExecution({
    workspaceId: event.workspaceId,
    periodStart: event.periodStart,
  });

  // Admin-triggered "force" runs (docs/03 §Admin surface) rewrite the execution
  // row to a fresh PENDING state so the public post and winner DMs re-fire.
  // Scheduled EventBridge invocations must never set this flag.
  const forceRepublish = event.forceRepublish === true;

  const execution = await ensurePendingExecution({
    event,
    existing: forceRepublish ? null : existing,
    winners,
    countsBySlackId,
    forceRepublish,
    deps,
  });

  const published = await ensurePublished({
    event,
    execution,
    winners,
    forceRepublish,
    deps,
    log,
  });

  if (winners.length === 0) return;

  await deliverWinnerDms({
    event,
    execution: published,
    winners,
    nominations,
    deps,
    log,
  });
}

interface PendingContext {
  event: BiweeklyReportRequestedV1;
  existing: ReportExecutionItem | null;
  winners: Winner[];
  countsBySlackId: Record<string, number>;
  forceRepublish: boolean;
  deps: RunReportDeps;
}

async function ensurePendingExecution({
  event,
  existing,
  winners,
  countsBySlackId,
  forceRepublish,
  deps,
}: PendingContext): Promise<ReportExecutionItem> {
  if (existing) return existing;
  const pending: ReportExecutionItem = {
    entityType: "REPORT_EXECUTION",
    workspaceId: event.workspaceId,
    periodStart: event.periodStart,
    periodEnd: event.periodEnd,
    status: "PENDING",
    winnerSlackIds: winners.map((w) => w.recipientSlackId),
    countsBySlackId,
    dmDeliveries: winners.map(
      (w): WinnerDmDelivery => ({
        recipientSlackId: w.recipientSlackId,
        status: "PENDING",
        attempts: 0,
      }),
    ),
    retentionPolicy: "PUBLISHED_METADATA_INDEFINITE",
  };
  if (forceRepublish) {
    // Admin force run: the previous execution row (if any) is replaced so the
    // downstream publish + DM steps behave as a fresh execution.
    await deps.reports.overwritePendingExecution(pending);
  } else {
    await deps.reports.putPendingExecution(pending);
  }
  return pending;
}

interface PublishContext {
  event: BiweeklyReportRequestedV1;
  execution: ReportExecutionItem;
  winners: Winner[];
  forceRepublish: boolean;
  deps: RunReportDeps;
  log: Logger;
}

async function ensurePublished({
  event,
  execution,
  winners,
  forceRepublish,
  deps,
  log,
}: PublishContext): Promise<ReportExecutionItem> {
  if (execution.publicMessageTs && !forceRepublish) {
    // Already posted on a prior invocation. Resume DM retries.
    return execution;
  }

  const message =
    winners.length === 0
      ? buildEmptyPeriodMessage(event.periodEnd)
      : buildReportMessage({
          periodStart: event.periodStart,
          periodEnd: event.periodEnd,
          winners,
        });
  const posted = await deps.slack.postMessage({
    channel: deps.recognitionChannelId,
    text: message.text,
    blocks: message.blocks,
    workspaceId: event.workspaceId,
  });
  const publishedAt = new Date(deps.now()).toISOString();
  await deps.reports.markPublished({
    workspaceId: event.workspaceId,
    periodStart: event.periodStart,
    publicMessageTs: posted.ts,
    publishedAt,
  });
  log.info("report_published", {
    outcome: "PUBLISHED",
    winnerCount: winners.length,
  });
  return {
    ...execution,
    status: "PUBLISHED",
    publicMessageTs: posted.ts,
    publishedAt,
  };
}

interface DeliverContext {
  event: BiweeklyReportRequestedV1;
  execution: ReportExecutionItem;
  winners: Winner[];
  nominations: NominationItem[];
  deps: RunReportDeps;
  log: Logger;
}

async function deliverWinnerDms({
  event,
  execution,
  winners,
  nominations,
  deps,
  log,
}: DeliverContext): Promise<void> {
  const descriptionsBySlackId = new Map<string, string[]>();
  for (const winner of winners) {
    descriptionsBySlackId.set(winner.recipientSlackId, []);
  }
  for (const nomination of nominations) {
    const bucket = descriptionsBySlackId.get(nomination.recipientSlackId);
    if (bucket) bucket.push(nomination.description);
  }

  const deliveriesById = new Map<string, WinnerDmDelivery>();
  for (const entry of execution.dmDeliveries) {
    deliveriesById.set(entry.recipientSlackId, entry);
  }

  for (const winner of winners) {
    const current =
      deliveriesById.get(winner.recipientSlackId) ??
      ({
        recipientSlackId: winner.recipientSlackId,
        status: "PENDING",
        attempts: 0,
      } as WinnerDmDelivery);
    if (current.status === "SENT" || current.status === "FAILED_TERMINAL") {
      continue;
    }

    const descriptions = descriptionsBySlackId.get(winner.recipientSlackId) ?? [];
    const attemptedAt = new Date(deps.now()).toISOString();
    try {
      const { channel } = await deps.slack.openDm({
        userSlackId: winner.recipientSlackId,
        workspaceId: event.workspaceId,
      });
      const dm = buildWinnerDm({
        periodStart: event.periodStart,
        periodEnd: event.periodEnd,
        descriptions,
      });
      await deps.slack.postMessage({
        channel,
        text: dm.text,
        blocks: dm.blocks,
        workspaceId: event.workspaceId,
      });
      await deps.reports.updateDmDelivery({
        workspaceId: event.workspaceId,
        periodStart: event.periodStart,
        delivery: {
          recipientSlackId: winner.recipientSlackId,
          status: "SENT",
          attempts: current.attempts + 1,
          lastAttemptAt: attemptedAt,
        },
      });
      log.info("winner_dm_sent", {
        outcome: "SENT",
        recipient: winner.recipientSlackId,
      });
    } catch (err) {
      const errorCategory = err instanceof Error ? err.name : "unknown";
      await deps.reports.updateDmDelivery({
        workspaceId: event.workspaceId,
        periodStart: event.periodStart,
        delivery: {
          recipientSlackId: winner.recipientSlackId,
          status: "FAILED_RETRYABLE",
          attempts: current.attempts + 1,
          lastAttemptAt: attemptedAt,
          lastError: errorCategory,
        },
      });
      log.warn("winner_dm_failed", {
        outcome: "FAILED_RETRYABLE",
        recipient: winner.recipientSlackId,
        errorCategory,
      });
    }
  }
}
