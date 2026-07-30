import { describe, expect, it } from "vitest";
import type { NominationItem } from "../entities/Nomination.js";
import { tallyWinners } from "../services/scoring.js";

function n(recipient: string, id = recipient): NominationItem {
  return {
    entityType: "NOMINATION",
    workspaceId: "T1",
    nominationId: id,
    nominatorSlackId: `NOM-${id}`,
    recipientSlackId: recipient,
    description: "irrelevant to scoring",
    submittedAt: "2026-08-01T14:30:00.000Z",
    submittedAtEpochMs: Date.parse("2026-08-01T14:30:00.000Z"),
    reportPeriodStart: "2026-07-31T04:00:00.000Z",
    reportPeriodEnd: "2026-08-14T16:00:00.000Z",
    sourceType: "CHANNEL",
    status: "ACTIVE",
    retentionExpiresAt: 9_999_999_999,
  };
}

describe("tallyWinners", () => {
  it("returns [] for an empty period", () => {
    expect(tallyWinners([])).toEqual([]);
  });

  it("picks a single winner when one recipient dominates", () => {
    const winners = tallyWinners([n("U_A", "1"), n("U_A", "2"), n("U_B", "3")]);
    expect(winners).toEqual([{ recipientSlackId: "U_A", count: 2 }]);
  });

  it("returns every tied recipient at the top score", () => {
    const winners = tallyWinners([
      n("U_A", "1"),
      n("U_A", "2"),
      n("U_B", "3"),
      n("U_B", "4"),
      n("U_C", "5"),
    ]);
    const ids = winners.map((w) => w.recipientSlackId).sort();
    expect(ids).toEqual(["U_A", "U_B"]);
    for (const winner of winners) {
      expect(winner.count).toBe(2);
    }
  });

  it("gives every recipient one point regardless of who nominated them", () => {
    // Same nominator nominating the same recipient still contributes each
    // point once. The eligibility rule blocks this in practice; scoring must
    // remain oblivious.
    const winners = tallyWinners([n("U_A", "1"), n("U_A", "2"), n("U_A", "3")]);
    expect(winners).toEqual([{ recipientSlackId: "U_A", count: 3 }]);
  });
});
