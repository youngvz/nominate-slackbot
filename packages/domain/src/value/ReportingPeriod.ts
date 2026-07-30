// docs/10-scheduling-and-reporting.md. All schedules use America/New_York.
export const PROGRAM_TIMEZONE = "America/New_York";
export const PROGRAM_START_ISO = "2026-07-31T00:00:00-04:00";
export const FIRST_REPORT_ISO = "2026-08-14T12:00:00-04:00";
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
