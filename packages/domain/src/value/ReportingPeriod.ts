// docs/10-scheduling-and-reporting.md. All schedules use America/New_York.
export const PROGRAM_TIMEZONE = "America/New_York";

// Defaults are the real program anchors. Dev environments may shift the
// program start (and the first-report anchor derived from it) via env vars so
// that pre-launch demos land inside a real period. Production must not set
// these overrides.
const DEFAULT_PROGRAM_START_ISO = "2026-07-31T00:00:00-04:00";
const DEFAULT_FIRST_REPORT_ISO = "2026-08-14T12:00:00-04:00";

function envOverride(name: string, fallback: string): string {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (!raw) return fallback;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return fallback;
  return raw;
}

export const PROGRAM_START_ISO = envOverride(
  "PROGRAM_START_AT",
  DEFAULT_PROGRAM_START_ISO,
);
export const FIRST_REPORT_ISO = envOverride(
  "FIRST_REPORT_AT",
  DEFAULT_FIRST_REPORT_ISO,
);
export const PERIOD_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

const PROGRAM_START_EPOCH_MS = Date.parse(PROGRAM_START_ISO);
const FIRST_REPORT_EPOCH_MS = Date.parse(FIRST_REPORT_ISO);

export interface ReportingPeriod {
  start: string;
  end: string;
  startEpochMs: number;
  endEpochMs: number;
}

function period(startEpochMs: number, endEpochMs: number): ReportingPeriod {
  return {
    start: new Date(startEpochMs).toISOString(),
    end: new Date(endEpochMs).toISOString(),
    startEpochMs,
    endEpochMs,
  };
}

// Half-open period containing an epoch. A submission exactly at `end` belongs
// to the next period per docs/02 §Reporting periods.
//
// Period boundaries after the first report are anchored to FIRST_REPORT_EPOCH
// plus multiples of PERIOD_LENGTH_MS. Real local-time boundaries drift by one
// hour across DST transitions; the report job uses its scheduled execution
// time as the authoritative window edge, so this stamp is a stable metadata
// pointer, not a scheduler input.
export function periodContaining(epochMs: number): ReportingPeriod {
  if (epochMs < FIRST_REPORT_EPOCH_MS) {
    return period(PROGRAM_START_EPOCH_MS, FIRST_REPORT_EPOCH_MS);
  }
  const offset = epochMs - FIRST_REPORT_EPOCH_MS;
  const n = Math.floor(offset / PERIOD_LENGTH_MS);
  const start = FIRST_REPORT_EPOCH_MS + n * PERIOD_LENGTH_MS;
  return period(start, start + PERIOD_LENGTH_MS);
}

export function periodStartingAt(startEpochMs: number): ReportingPeriod {
  return period(startEpochMs, startEpochMs + PERIOD_LENGTH_MS);
}

// The reporting period whose `end` is the most recent boundary at or before
// `nowEpochMs`. Returns null before the first report anchor, when no period
// has closed yet.
//
// This is the window a scheduled report invocation should aggregate over:
// EventBridge fires at (or shortly after) a period boundary, and we want the
// window that just closed — not the currently-open one. Late fires (retries
// arriving after the boundary) still resolve to the same window because we
// snap `end` down to the largest boundary <= now.
export function mostRecentClosedPeriod(
  nowEpochMs: number,
): ReportingPeriod | null {
  if (nowEpochMs < FIRST_REPORT_EPOCH_MS) return null;
  const offset = nowEpochMs - FIRST_REPORT_EPOCH_MS;
  const n = Math.floor(offset / PERIOD_LENGTH_MS);
  const boundary = FIRST_REPORT_EPOCH_MS + n * PERIOD_LENGTH_MS;
  // The first period is anchored on PROGRAM_START, not on FIRST_REPORT - 14d.
  const start = n === 0 ? PROGRAM_START_EPOCH_MS : boundary - PERIOD_LENGTH_MS;
  return period(start, boundary);
}
