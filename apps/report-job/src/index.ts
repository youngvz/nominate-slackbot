import { NotImplementedError } from "@nominate/observability";
import type { Handler } from "aws-lambda";
import type { BiweeklyReportRequestedV1 } from "@nominate/contracts";

// docs/10 §Biweekly report. Every other Friday 12:00 PM America/New_York.
// First report 2026-08-14. Reporting windows are half-open [start, end).
export const handler: Handler<BiweeklyReportRequestedV1, void> = async (_event) => {
  throw new NotImplementedError("report-job handler");
};
