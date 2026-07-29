import { NotImplementedError } from "@nominate/observability";
import type { NominationItem } from "../entities/Nomination.js";
import type { Winner } from "../entities/Winner.js";

// docs/02 §Scoring + docs/10 §Aggregation. All ties for the maximum are winners.
export function tallyWinners(_nominations: readonly NominationItem[]): Winner[] {
  throw new NotImplementedError("tallyWinners");
}
