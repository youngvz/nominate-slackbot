import { NotImplementedError } from "@nominate/observability";

// docs/10-scheduling-and-reporting.md. All schedules use America/New_York.
export const PROGRAM_TIMEZONE = "America/New_York";
export const PROGRAM_START_ISO = "2026-07-31T00:00:00-04:00";
export const FIRST_REPORT_ISO = "2026-08-14T12:00:00-04:00";
export const PERIOD_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

export interface ReportingPeriod {
  start: string;
  end: string;
  startEpochMs: number;
  endEpochMs: number;
}

// Half-open period containing an epoch. A submission exactly at `end` belongs to
// the next period per docs/02 §Reporting periods.
export function periodContaining(_epochMs: number): ReportingPeriod {
  throw new NotImplementedError("periodContaining");
}

export function periodStartingAt(_startEpochMs: number): ReportingPeriod {
  throw new NotImplementedError("periodStartingAt");
}
