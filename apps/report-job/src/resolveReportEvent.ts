import type { BiweeklyReportRequestedV1 } from "@nominate/contracts";
import { mostRecentClosedPeriod } from "@nominate/domain";

// docs/10 §Scheduled input contract. EventBridge Scheduler is configured with
// no `input` block, so it invokes the Lambda with `{}`. The admin path
// (docs/03 §Admin surface) invokes the same Lambda with a fully-populated
// envelope. Both codepaths converge here: any missing field is derived from
// wall-clock time and injected config so `runReport` always receives a valid
// `BiweeklyReportRequestedV1`.
//
// Admin-provided fields always win — we never overwrite an explicit
// workspaceId or period. This preserves the on-demand override semantics.

export interface ResolveDeps {
  now: () => number;
  defaultWorkspaceId: string | undefined;
}

export class UnresolvableReportEventError extends Error {
  readonly code: string;
  constructor(code: string, detail: string) {
    // Include the code in the message so log grep and test matchers can
    // find either. The typed `code` field is authoritative for callers.
    super(`${code}: ${detail}`);
    this.name = "UnresolvableReportEventError";
    this.code = code;
  }
}

interface PartialEvent {
  eventType?: unknown;
  schemaVersion?: unknown;
  workspaceId?: unknown;
  scheduledAt?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
  executionKey?: unknown;
  forceRepublish?: unknown;
}

export function resolveReportEvent(
  raw: unknown,
  deps: ResolveDeps,
): BiweeklyReportRequestedV1 {
  const input: PartialEvent =
    raw !== null && typeof raw === "object" ? (raw as PartialEvent) : {};

  const nowEpochMs = deps.now();
  const nowIso = new Date(nowEpochMs).toISOString();

  const workspaceId =
    typeof input.workspaceId === "string" && input.workspaceId.length > 0
      ? input.workspaceId
      : deps.defaultWorkspaceId;
  if (!workspaceId) {
    throw new UnresolvableReportEventError(
      "MISSING_WORKSPACE",
      "Report event is missing workspaceId and REPORT_WORKSPACE_ID is unset.",
    );
  }

  const hasPeriodStart =
    typeof input.periodStart === "string" && input.periodStart.length > 0;
  const hasPeriodEnd =
    typeof input.periodEnd === "string" && input.periodEnd.length > 0;

  let periodStart: string;
  let periodEnd: string;
  if (hasPeriodStart && hasPeriodEnd) {
    periodStart = input.periodStart as string;
    periodEnd = input.periodEnd as string;
  } else if (!hasPeriodStart && !hasPeriodEnd) {
    const closed = mostRecentClosedPeriod(nowEpochMs);
    if (!closed) {
      throw new UnresolvableReportEventError(
        "BEFORE_FIRST_REPORT",
        `Scheduled report invocation at ${nowIso} but the first reporting period has not closed yet.`,
      );
    }
    periodStart = closed.start;
    periodEnd = closed.end;
  } else {
    throw new UnresolvableReportEventError(
      "PARTIAL_PERIOD",
      "Report event has only one of periodStart/periodEnd — provide both or neither.",
    );
  }

  const scheduledAt =
    typeof input.scheduledAt === "string" && input.scheduledAt.length > 0
      ? input.scheduledAt
      : nowIso;

  const executionKey =
    typeof input.executionKey === "string" && input.executionKey.length > 0
      ? input.executionKey
      : `${workspaceId}#${periodStart}`;

  const forceRepublish = input.forceRepublish === true;

  return {
    eventType: "report.biweekly.requested",
    schemaVersion: 1,
    workspaceId,
    scheduledAt,
    periodStart,
    periodEnd,
    executionKey,
    ...(forceRepublish ? { forceRepublish: true } : {}),
  };
}
