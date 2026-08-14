import type { BiweeklyReportRequestedV1 } from "@nominate/contracts";
import type {
  NominationItem,
  ReportExecutionItem,
  WinnerDmDelivery,
} from "@nominate/domain";
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

// docs/04 §Report Lambda + docs/10 §Aggregation, §Public message, §Recipient DMs.
// docs/adr/ADR-007: everyone with ≥1 nomination this period is named publicly
// and DMed their descriptions — no top-count filtering. Idempotency is anchored
// to the REPORT_EXECUTION row: PENDING → PUBLISHED → per-recipient DMs. A retry
// that lands after PUBLISHED must never re-post the public message; a DM
// failure must not roll back publication (docs/02 §Publication rules).

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

  const countsBySlackId: Record<string, number> = {};
  for (const nomination of nominations) {
    countsBySlackId[nomination.recipientSlackId] =
      (countsBySlackId[nomination.recipientSlackId] ?? 0) + 1;
  }
  // Every teammate with ≥1 nomination is a recipient. Sorted for deterministic
  // ordering so retries and admin re-runs produce identical output.
  const recipientSlackIds = Object.keys(countsBySlackId).sort();

  const existing = await deps.reports.getExecution({
    workspaceId: event.workspaceId,
    periodStart: event.periodStart,
  });

  // Admin-triggered "force" runs (docs/03 §Admin surface) rewrite the execution
  // row to a fresh PENDING state so the public post and recipient DMs re-fire.
  // Scheduled EventBridge invocations must never set this flag.
  const forceRepublish = event.forceRepublish === true;

  const execution = await ensurePendingExecution({
    event,
    existing: forceRepublish ? null : existing,
    recipientSlackIds,
    countsBySlackId,
    forceRepublish,
    deps,
  });

  const published = await ensurePublished({
    event,
    execution,
    recipientSlackIds,
    forceRepublish,
    deps,
    log,
  });

  if (recipientSlackIds.length === 0) return;

  await deliverRecipientDms({
    event,
    execution: published,
    recipientSlackIds,
    nominations,
    deps,
    log,
  });
}

interface PendingContext {
  event: BiweeklyReportRequestedV1;
  existing: ReportExecutionItem | null;
  recipientSlackIds: readonly string[];
  countsBySlackId: Record<string, number>;
  forceRepublish: boolean;
  deps: RunReportDeps;
}

async function ensurePendingExecution({
  event,
  existing,
  recipientSlackIds,
  countsBySlackId,
  forceRepublish,
  deps,
}: PendingContext): Promise<ReportExecutionItem> {
  if (existing) return existing;
  // winnerSlackIds field carries every recipient now; the field name is a
  // rename target (see ADR-007) but the storage semantics are unchanged.
  const pending: ReportExecutionItem = {
    entityType: "REPORT_EXECUTION",
    workspaceId: event.workspaceId,
    periodStart: event.periodStart,
    periodEnd: event.periodEnd,
    status: "PENDING",
    winnerSlackIds: [...recipientSlackIds],
    countsBySlackId,
    dmDeliveries: recipientSlackIds.map(
      (recipientSlackId): WinnerDmDelivery => ({
        recipientSlackId,
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
  recipientSlackIds: readonly string[];
  forceRepublish: boolean;
  deps: RunReportDeps;
  log: Logger;
}

async function ensurePublished({
  event,
  execution,
  recipientSlackIds,
  forceRepublish,
  deps,
  log,
}: PublishContext): Promise<ReportExecutionItem> {
  if (execution.publicMessageTs && !forceRepublish) {
    // Already posted on a prior invocation. Resume DM retries.
    return execution;
  }

  const message =
    recipientSlackIds.length === 0
      ? buildEmptyPeriodMessage(event.periodEnd)
      : buildReportMessage({
          periodStart: event.periodStart,
          periodEnd: event.periodEnd,
          recipientSlackIds,
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
    recipientCount: recipientSlackIds.length,
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
  recipientSlackIds: readonly string[];
  nominations: NominationItem[];
  deps: RunReportDeps;
  log: Logger;
}

async function deliverRecipientDms({
  event,
  execution,
  recipientSlackIds,
  nominations,
  deps,
  log,
}: DeliverContext): Promise<void> {
  const descriptionsBySlackId = new Map<string, string[]>();
  for (const recipientSlackId of recipientSlackIds) {
    descriptionsBySlackId.set(recipientSlackId, []);
  }
  for (const nomination of nominations) {
    const bucket = descriptionsBySlackId.get(nomination.recipientSlackId);
    if (bucket) bucket.push(nomination.description);
  }

  const deliveriesById = new Map<string, WinnerDmDelivery>();
  for (const entry of execution.dmDeliveries) {
    deliveriesById.set(entry.recipientSlackId, entry);
  }

  for (const recipientSlackId of recipientSlackIds) {
    const current =
      deliveriesById.get(recipientSlackId) ??
      ({
        recipientSlackId,
        status: "PENDING",
        attempts: 0,
      } as WinnerDmDelivery);
    if (current.status === "SENT" || current.status === "FAILED_TERMINAL") {
      continue;
    }

    const descriptions = descriptionsBySlackId.get(recipientSlackId) ?? [];
    const attemptedAt = new Date(deps.now()).toISOString();
    try {
      const { channel } = await deps.slack.openDm({
        userSlackId: recipientSlackId,
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
          recipientSlackId,
          status: "SENT",
          attempts: current.attempts + 1,
          lastAttemptAt: attemptedAt,
        },
      });
      log.info("recipient_dm_sent", {
        outcome: "SENT",
        recipient: recipientSlackId,
      });
    } catch (err) {
      const errorCategory = err instanceof Error ? err.name : "unknown";
      await deps.reports.updateDmDelivery({
        workspaceId: event.workspaceId,
        periodStart: event.periodStart,
        delivery: {
          recipientSlackId,
          status: "FAILED_RETRYABLE",
          attempts: current.attempts + 1,
          lastAttemptAt: attemptedAt,
          lastError: errorCategory,
        },
      });
      log.warn("recipient_dm_failed", {
        outcome: "FAILED_RETRYABLE",
        recipient: recipientSlackId,
        errorCategory,
      });
    }
  }
}
