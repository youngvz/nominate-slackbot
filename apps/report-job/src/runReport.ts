import { NotImplementedError } from "@nominate/observability";
import type { BiweeklyReportRequestedV1 } from "@nominate/contracts";

// docs/04 §Report Lambda + docs/10 §Aggregation. Query GSI1 for the period,
// tally, publish the public message, THEN send winner DMs. DM failure must not
// roll back a successful public publication (docs/02 §Publication rules).
export function runReport(_event: BiweeklyReportRequestedV1): Promise<void> {
  throw new NotImplementedError("runReport");
}
