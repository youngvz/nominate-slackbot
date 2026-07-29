import { NotImplementedError } from "@nominate/observability";

// docs/10 §Aggregation step 6: publish a no-activity message when the period is
// empty.
export function buildEmptyPeriodMessage(_periodEnd: string): { text: string; blocks: unknown[] } {
  throw new NotImplementedError("buildEmptyPeriodMessage");
}
