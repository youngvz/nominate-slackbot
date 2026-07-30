import type { NominationItem } from "../entities/Nomination.js";
import type { Winner } from "../entities/Winner.js";

// docs/02 §Scoring + docs/10 §Aggregation. One point per valid nomination,
// descriptions and nominator identity do not influence score, and every
// recipient tied at the maximum is a winner.
export function tallyWinners(nominations: readonly NominationItem[]): Winner[] {
  if (nominations.length === 0) return [];

  const counts = new Map<string, number>();
  for (const nomination of nominations) {
    counts.set(
      nomination.recipientSlackId,
      (counts.get(nomination.recipientSlackId) ?? 0) + 1,
    );
  }

  let max = 0;
  for (const count of counts.values()) {
    if (count > max) max = count;
  }

  const winners: Winner[] = [];
  for (const [recipientSlackId, count] of counts) {
    if (count === max) winners.push({ recipientSlackId, count });
  }
  return winners;
}
