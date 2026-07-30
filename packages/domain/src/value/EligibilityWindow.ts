// Single source of truth for the rolling repeat-nomination window.
// docs/02-business-rules.md §Rolling repeat-nomination rule: exactly 14 x 24 hours.
export const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function computeNextEligibleAtEpoch(acceptedAtEpochMs: number): number {
  return acceptedAtEpochMs + WINDOW_MS;
}

export function computeNextEligibleAtIso(acceptedAtIso: string): string {
  const epoch = Date.parse(acceptedAtIso);
  if (Number.isNaN(epoch)) {
    throw new RangeError(`Invalid acceptedAt ISO timestamp: ${acceptedAtIso}`);
  }
  return new Date(computeNextEligibleAtEpoch(epoch)).toISOString();
}
