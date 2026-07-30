import { describe, expect, it } from "vitest";
import {
  FIRST_REPORT_ISO,
  PERIOD_LENGTH_MS,
  PROGRAM_START_ISO,
  periodContaining,
  periodStartingAt,
} from "../value/ReportingPeriod.js";

const FIRST_REPORT_EPOCH = Date.parse(FIRST_REPORT_ISO);
const PROGRAM_START_EPOCH = Date.parse(PROGRAM_START_ISO);

describe("periodContaining", () => {
  it("returns the first period for submissions between program start and the first report", () => {
    const period = periodContaining(PROGRAM_START_EPOCH + 60_000);
    expect(period.startEpochMs).toBe(PROGRAM_START_EPOCH);
    expect(period.endEpochMs).toBe(FIRST_REPORT_EPOCH);
  });

  it("returns a period that includes its start and excludes its end (half-open)", () => {
    const atBoundary = periodContaining(FIRST_REPORT_EPOCH);
    expect(atBoundary.startEpochMs).toBe(FIRST_REPORT_EPOCH);
    expect(atBoundary.endEpochMs).toBe(FIRST_REPORT_EPOCH + PERIOD_LENGTH_MS);
  });

  it("advances by PERIOD_LENGTH_MS for a submission in the second period", () => {
    const midSecond = FIRST_REPORT_EPOCH + PERIOD_LENGTH_MS + 1;
    const period = periodContaining(midSecond);
    expect(period.startEpochMs).toBe(FIRST_REPORT_EPOCH + PERIOD_LENGTH_MS);
    expect(period.endEpochMs).toBe(FIRST_REPORT_EPOCH + 2 * PERIOD_LENGTH_MS);
  });
});

describe("periodStartingAt", () => {
  it("builds a fixed-length period from a start epoch", () => {
    const period = periodStartingAt(FIRST_REPORT_EPOCH);
    expect(period.endEpochMs - period.startEpochMs).toBe(PERIOD_LENGTH_MS);
  });
});
