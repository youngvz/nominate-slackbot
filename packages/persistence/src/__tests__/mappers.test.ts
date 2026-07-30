import { describe, expect, it } from "vitest";
import type {
  EligibilityItem,
  NominationItem,
  ReminderExecutionItem,
  ReportExecutionItem,
} from "@nominate/domain";
import { keys } from "../keys.js";
import {
  fromEligibilityDdbItem,
  toEligibilityDdbItem,
} from "../mappers/eligibility.js";
import {
  fromNominationDdbItem,
  toNominationDdbItem,
} from "../mappers/nomination.js";
import {
  fromReminderDdbItem,
  toReminderDdbItem,
} from "../mappers/reminder.js";
import { fromReportDdbItem, toReportDdbItem } from "../mappers/report.js";

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

const reportPending: ReportExecutionItem = {
  entityType: "REPORT_EXECUTION",
  workspaceId: "T1",
  periodStart: "2026-07-31T04:00:00.000Z",
  periodEnd: "2026-08-14T16:00:00.000Z",
  status: "PENDING",
  winnerSlackIds: [],
  countsBySlackId: {},
  dmDeliveries: [],
  retentionPolicy: "PUBLISHED_METADATA_INDEFINITE",
};

const reportPublished: ReportExecutionItem = {
  entityType: "REPORT_EXECUTION",
  workspaceId: "T1",
  periodStart: "2026-07-31T04:00:00.000Z",
  periodEnd: "2026-08-14T16:00:00.000Z",
  status: "PUBLISHED",
  winnerSlackIds: ["U_A", "U_B"],
  countsBySlackId: { U_A: 3, U_B: 3, U_C: 1 },
  publicMessageTs: "1725000000.000100",
  publishedAt: "2026-08-14T16:00:01.000Z",
  dmDeliveries: [
    {
      recipientSlackId: "U_A",
      status: "SENT",
      attempts: 1,
      lastAttemptAt: "2026-08-14T16:00:02.000Z",
    },
    {
      recipientSlackId: "U_B",
      status: "FAILED_RETRYABLE",
      attempts: 2,
      lastAttemptAt: "2026-08-14T16:00:03.000Z",
      lastError: "channel_not_found",
    },
  ],
  retentionPolicy: "PUBLISHED_METADATA_INDEFINITE",
};

describe("report mapper", () => {
  it("round-trips a PENDING execution row", () => {
    expect(fromReportDdbItem(toReportDdbItem(reportPending))).toEqual(reportPending);
  });

  it("round-trips a PUBLISHED execution row with winners and delivery state", () => {
    expect(fromReportDdbItem(toReportDdbItem(reportPublished))).toEqual(reportPublished);
  });

  it("populates PK/SK for the workspace and period", () => {
    const raw = toReportDdbItem(reportPublished);
    expect(raw.PK).toBe(keys.reportPK(reportPublished.workspaceId));
    expect(raw.SK).toBe(keys.reportSK(reportPublished.periodStart));
  });
});

const reminderPending: ReminderExecutionItem = {
  entityType: "REMINDER_EXECUTION",
  workspaceId: "T1",
  scheduledAt: "2026-08-07T13:00:00.000Z",
  status: "PENDING",
};

const reminderPosted: ReminderExecutionItem = {
  entityType: "REMINDER_EXECUTION",
  workspaceId: "T1",
  scheduledAt: "2026-08-07T13:00:00.000Z",
  status: "POSTED",
  publicMessageTs: "1754571600.000100",
  postedAt: "2026-08-07T13:00:01.000Z",
};

describe("reminder mapper", () => {
  it("round-trips a PENDING reminder row", () => {
    expect(fromReminderDdbItem(toReminderDdbItem(reminderPending))).toEqual(
      reminderPending,
    );
  });

  it("round-trips a POSTED reminder row with public message ts", () => {
    expect(fromReminderDdbItem(toReminderDdbItem(reminderPosted))).toEqual(
      reminderPosted,
    );
  });

  it("populates PK/SK for the workspace and scheduled time", () => {
    const raw = toReminderDdbItem(reminderPending);
    expect(raw.PK).toBe(keys.reminderPK(reminderPending.workspaceId));
    expect(raw.SK).toBe(keys.reminderSK(reminderPending.scheduledAt));
  });
});
