import { NotImplementedError } from "@nominate/observability";

// docs/10 §Winner DMs. Contains only descriptions for this winner and period.
// Never reveals nominator IDs, names, or handles.
export function buildWinnerDm(_input: {
  periodStart: string;
  periodEnd: string;
  descriptions: readonly string[];
}): { text: string; blocks: unknown[] } {
  throw new NotImplementedError("buildWinnerDm");
}
