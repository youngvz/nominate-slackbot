import { describe, expect, it } from "vitest";
import {
  computeNextEligibleAtEpoch,
  computeNextEligibleAtIso,
  WINDOW_MS,
} from "../value/EligibilityWindow.js";

describe("EligibilityWindow", () => {
  it("adds exactly 14 x 24 hours to the accepted epoch", () => {
    const accepted = Date.UTC(2026, 7, 1, 14, 30);
    expect(computeNextEligibleAtEpoch(accepted)).toBe(accepted + 14 * 24 * 60 * 60 * 1000);
    expect(WINDOW_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it("returns an ISO timestamp exactly 14 days after acceptedAtIso", () => {
    expect(computeNextEligibleAtIso("2026-08-01T14:30:00.000Z")).toBe(
      "2026-08-15T14:30:00.000Z",
    );
  });

  it("throws on an invalid ISO string", () => {
    expect(() => computeNextEligibleAtIso("not-a-date")).toThrow(RangeError);
  });
});
