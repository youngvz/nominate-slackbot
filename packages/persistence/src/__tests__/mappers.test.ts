import { describe, expect, it } from "vitest";
import type { EligibilityItem, NominationItem } from "@nominate/domain";
import { keys } from "../keys.js";
import {
  fromEligibilityDdbItem,
  toEligibilityDdbItem,
} from "../mappers/eligibility.js";
import {
  fromNominationDdbItem,
  toNominationDdbItem,
} from "../mappers/nomination.js";

const nomination: NominationItem = {
  entityType: "NOMINATION",
  workspaceId: "T1",
  nominationId: "N-1",
  nominatorSlackId: "U_A",
  recipientSlackId: "U_B",
  description: "Nice work.",
  submittedAt: "2026-08-01T14:30:00.000Z",
  submittedAtEpochMs: Date.parse("2026-08-01T14:30:00.000Z"),
  reportPeriodStart: "2026-07-31T04:00:00.000Z",
  reportPeriodEnd: "2026-08-14T16:00:00.000Z",
  sourceChannelId: "C1",
  sourceType: "CHANNEL",
  status: "ACTIVE",
  retentionExpiresAt: 9_999_999_999,
};

const eligibility: EligibilityItem = {
  entityType: "ELIGIBILITY",
  workspaceId: "T1",
  nominatorSlackId: "U_A",
  recipientSlackId: "U_B",
  nominationId: "N-1",
  acceptedAt: "2026-08-01T14:30:00.000Z",
  nextEligibleAt: "2026-08-15T14:30:00.000Z",
  nextEligibleAtEpoch: Date.parse("2026-08-15T14:30:00.000Z"),
  ttl: 9_999_999_999,
};

describe("nomination mapper", () => {
  it("round-trips a NominationItem", () => {
    expect(fromNominationDdbItem(toNominationDdbItem(nomination))).toEqual(nomination);
  });

  it("populates PK/SK and GSI1PK/GSI1SK for reporting queries", () => {
    const raw = toNominationDdbItem(nomination);
    expect(raw.PK).toBe(keys.nominationPK(nomination.workspaceId));
    expect(raw.SK).toBe(
      keys.nominationSK(nomination.submittedAtEpochMs, nomination.nominationId),
    );
    expect(raw.GSI1PK).toBe(keys.gsi1Pk(nomination.workspaceId));
    expect(raw.GSI1SK).toBe(
      keys.gsi1Sk(nomination.submittedAtEpochMs, nomination.nominationId),
    );
  });
});

describe("eligibility mapper", () => {
  it("round-trips an EligibilityItem", () => {
    expect(fromEligibilityDdbItem(toEligibilityDdbItem(eligibility))).toEqual(eligibility);
  });

  it("populates PK/SK for the pair lock", () => {
    const raw = toEligibilityDdbItem(eligibility);
    expect(raw.PK).toBe(
      keys.eligibilityPK(eligibility.workspaceId, eligibility.nominatorSlackId),
    );
    expect(raw.SK).toBe(keys.eligibilitySK(eligibility.recipientSlackId));
  });
});
