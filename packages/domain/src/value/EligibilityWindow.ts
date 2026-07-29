import { NotImplementedError } from "@nominate/observability";

// Single source of truth for the rolling repeat-nomination window.
// docs/02-business-rules.md §Rolling repeat-nomination rule: exactly 14 x 24 hours.
export const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function computeNextEligibleAtEpoch(_acceptedAtEpochMs: number): number {
  throw new NotImplementedError("computeNextEligibleAtEpoch");
}

export function computeNextEligibleAtIso(_acceptedAtIso: string): string {
  throw new NotImplementedError("computeNextEligibleAtIso");
}
