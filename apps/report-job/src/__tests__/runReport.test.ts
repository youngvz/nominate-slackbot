import { describe, expect, it, vi } from "vitest";
import type { BiweeklyReportRequestedV1 } from "@nominate/contracts";
import type {
  NominationItem,
  ReportExecutionItem,
  WinnerDmDelivery,
} from "@nominate/domain";
import { createLogger } from "@nominate/observability";
import type {
  NominationRepository,
  ReportRepository,
} from "@nominate/persistence";
import type { SlackClient } from "@nominate/slack";
import { runReport, type RunReportDeps } from "../runReport.js";

const RECOG = "C_RECOG";
const NOW = Date.UTC(2026, 7, 14, 16, 0, 1);

function event(
  overrides: Partial<BiweeklyReportRequestedV1> = {},
): BiweeklyReportRequestedV1 {
  return {
    eventType: "report.biweekly.requested",
    schemaVersion: 1,
    workspaceId: "T1",
    scheduledAt: "2026-08-14T16:00:00.000Z",
    periodStart: "2026-07-31T04:00:00.000Z",
    periodEnd: "2026-08-14T16:00:00.000Z",
    executionKey: "T1#2026-07-31",
    ...overrides,
  };
}

function nomination(
  recipient: string,
  description: string,
  id: string,
): NominationItem {
  return {
    entityType: "NOMINATION",
    workspaceId: "T1",
    nominationId: id,
    nominatorSlackId: `NOM-${id}`,
    recipientSlackId: recipient,
    description,
    submittedAt: "2026-08-05T14:00:00.000Z",
    submittedAtEpochMs: Date.parse("2026-08-05T14:00:00.000Z"),
    reportPeriodStart: "2026-07-31T04:00:00.000Z",
    reportPeriodEnd: "2026-08-14T16:00:00.000Z",
    sourceType: "CHANNEL",
    status: "ACTIVE",
    retentionExpiresAt: 9_999_999_999,
  };
}

interface Harness {
  deps: RunReportDeps;
  nominations: { queryByPeriod: ReturnType<typeof vi.fn> };
  reports: {
    getExecution: ReturnType<typeof vi.fn>;
    putPendingExecution: ReturnType<typeof vi.fn>;
    overwritePendingExecution: ReturnType<typeof vi.fn>;
    markPublished: ReturnType<typeof vi.fn>;
    updateDmDelivery: ReturnType<typeof vi.fn>;
  };
  slack: {
    postMessage: ReturnType<typeof vi.fn>;
    openDm: ReturnType<typeof vi.fn>;
    openView: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
  };
}

function harness(
  overrides: Partial<{
    nominations: NominationItem[];
    existingExecution: ReportExecutionItem | null;
    postMessageImpl: SlackClient["postMessage"];
    openDmImpl: SlackClient["openDm"];
  }> = {},
): Harness {
  const nominationsRepo: NominationRepository = {
    acceptNomination: vi.fn(),
    findById: vi.fn(),
    queryByPeriod: vi.fn().mockResolvedValue(overrides.nominations ?? []),
  };
  const reportsRepo: ReportRepository = {
    getExecution: vi.fn().mockResolvedValue(overrides.existingExecution ?? null),
    putPendingExecution: vi.fn().mockResolvedValue(undefined),
    overwritePendingExecution: vi.fn().mockResolvedValue(undefined),
    markPublished: vi.fn().mockResolvedValue(undefined),
    updateDmDelivery: vi.fn().mockResolvedValue(undefined),
  };
  const slack: SlackClient = {
    postMessage:
      overrides.postMessageImpl ??
      vi.fn().mockResolvedValue({ ts: "1725000000.000100", channel: RECOG }),
    openDm:
      overrides.openDmImpl ??
      vi.fn().mockImplementation(async ({ userSlackId }: { userSlackId: string }) => ({
        channel: `D-${userSlackId}`,
      })),
    openView: vi.fn(),
    getUser: vi.fn(),
  };
  const deps: RunReportDeps = {
    nominations: nominationsRepo,
    reports: reportsRepo,
    slack,
    recognitionChannelId: RECOG,
    logger: createLogger({ service: "test", environment: "test" }),
    now: () => NOW,
  };
  return {
    deps,
    nominations: nominationsRepo as never,
    reports: reportsRepo as never,
    slack: slack as never,
  };
}

describe("runReport", () => {
  it("publishes a shoutout naming every recipient and DMs each of them their descriptions", async () => {
    const noms = [
      nomination("U_A", "Kicked off migration", "n1"),
      nomination("U_A", "Owned the rollout", "n2"),
      nomination("U_B", "Helped review", "n3"),
    ];
    const h = harness({ nominations: noms });

    await runReport(event(), h.deps);

    // PENDING row created with counts and one delivery entry per recipient
    // (everyone with ≥1 nomination — see ADR-007).
    expect(h.reports.putPendingExecution).toHaveBeenCalledTimes(1);
    const pending = h.reports.putPendingExecution.mock
      .calls[0]![0] as ReportExecutionItem;
    expect(pending.status).toBe("PENDING");
    expect(pending.winnerSlackIds).toEqual(["U_A", "U_B"]);
    expect(pending.countsBySlackId).toEqual({ U_A: 2, U_B: 1 });
    expect(pending.dmDeliveries).toEqual([
      { recipientSlackId: "U_A", status: "PENDING", attempts: 0 },
      { recipientSlackId: "U_B", status: "PENDING", attempts: 0 },
    ]);

    // Public post names every recipient. No descriptions, no counts.
    expect(h.slack.postMessage).toHaveBeenCalled();
    const publicPost = h.slack.postMessage.mock.calls[0]![0] as {
      channel: string;
      text: string;
    };
    expect(publicPost.channel).toBe(RECOG);
    expect(publicPost.text).toContain("<@U_A>");
    expect(publicPost.text).toContain("<@U_B>");
    expect(publicPost.text).not.toContain("Kicked off migration");
    expect(h.reports.markPublished).toHaveBeenCalledTimes(1);

    // One DM per recipient, iterated in sorted Slack-ID order. Each DM
    // contains only the descriptions written about that recipient and no
    // nominator identifiers.
    const dmA = h.slack.postMessage.mock.calls[1]![0] as {
      channel: string;
      text: string;
    };
    expect(dmA.channel).toBe("D-U_A");
    expect(dmA.text).toContain("Kicked off migration");
    expect(dmA.text).toContain("Owned the rollout");
    expect(dmA.text).not.toContain("Helped review");
    expect(dmA.text).not.toContain("NOM-");

    const dmB = h.slack.postMessage.mock.calls[2]![0] as {
      channel: string;
      text: string;
    };
    expect(dmB.channel).toBe("D-U_B");
    expect(dmB.text).toContain("Helped review");
    expect(dmB.text).not.toContain("Kicked off migration");
    expect(dmB.text).not.toContain("NOM-");

    // Both delivery rows persisted as SENT.
    expect(h.reports.updateDmDelivery).toHaveBeenCalledTimes(2);
    const deliveries = h.reports.updateDmDelivery.mock.calls.map(
      (c) => (c[0] as { delivery: WinnerDmDelivery }).delivery,
    );
    expect(deliveries.every((d) => d.status === "SENT")).toBe(true);
    expect(deliveries.every((d) => d.attempts === 1)).toBe(true);
  });

  it("names every recipient regardless of count (count does not filter who is published or DMed)", async () => {
    const noms = [
      nomination("U_A", "one", "n1"),
      nomination("U_A", "two", "n2"),
      nomination("U_B", "three", "n3"),
      nomination("U_B", "four", "n4"),
    ];
    const h = harness({ nominations: noms });

    await runReport(event(), h.deps);

    const pending = h.reports.putPendingExecution.mock
      .calls[0]![0] as ReportExecutionItem;
    expect(pending.winnerSlackIds).toEqual(["U_A", "U_B"]);

    const publicPost = h.slack.postMessage.mock.calls[0]![0] as { text: string };
    expect(publicPost.text).toContain("<@U_A>");
    expect(publicPost.text).toContain("<@U_B>");

    // One DM per recipient.
    expect(h.slack.openDm).toHaveBeenCalledTimes(2);
    expect(h.reports.updateDmDelivery).toHaveBeenCalledTimes(2);
  });

  it("posts an empty-period message and skips DMs when there are zero nominations", async () => {
    const h = harness({ nominations: [] });

    await runReport(event(), h.deps);

    expect(h.slack.postMessage).toHaveBeenCalledTimes(1);
    const post = h.slack.postMessage.mock.calls[0]![0] as { text: string };
    // Empty-period copy is picked at random from a pool of variants; assert
    // on shared structural traits instead of a single substring. All variants
    // point users at /kudos and none of them contain a winner mention.
    expect(post.text).toContain("/kudos");
    expect(post.text).not.toMatch(/<@U[A-Z0-9]+>/);
    expect(h.slack.openDm).not.toHaveBeenCalled();
    expect(h.reports.updateDmDelivery).not.toHaveBeenCalled();
  });

  it("does not re-post the public message on a replay after PUBLISHED but still retries pending DMs", async () => {
    const noms = [
      nomination("U_A", "one", "n1"),
      nomination("U_A", "two", "n2"),
    ];
    const existing: ReportExecutionItem = {
      entityType: "REPORT_EXECUTION",
      workspaceId: "T1",
      periodStart: "2026-07-31T04:00:00.000Z",
      periodEnd: "2026-08-14T16:00:00.000Z",
      status: "PUBLISHED",
      winnerSlackIds: ["U_A"],
      countsBySlackId: { U_A: 2 },
      publicMessageTs: "1725000000.000100",
      publishedAt: "2026-08-14T16:00:01.000Z",
      dmDeliveries: [
        {
          recipientSlackId: "U_A",
          status: "FAILED_RETRYABLE",
          attempts: 1,
          lastAttemptAt: "2026-08-14T16:00:02.000Z",
          lastError: "rate_limited",
        },
      ],
      retentionPolicy: "PUBLISHED_METADATA_INDEFINITE",
    };
    const h = harness({ nominations: noms, existingExecution: existing });

    await runReport(event(), h.deps);

    // No new PENDING row (the getExecution came back non-null).
    expect(h.reports.putPendingExecution).not.toHaveBeenCalled();
    // No re-publish, no markPublished.
    expect(h.reports.markPublished).not.toHaveBeenCalled();
    // Only the DM postMessage; no channel post.
    expect(h.slack.postMessage).toHaveBeenCalledTimes(1);
    expect(h.slack.postMessage.mock.calls[0]![0].channel).toBe("D-U_A");
    // Delivery marked SENT with attempts incremented.
    const delivery = h.reports.updateDmDelivery.mock.calls[0]![0]
      .delivery as WinnerDmDelivery;
    expect(delivery.status).toBe("SENT");
    expect(delivery.attempts).toBe(2);
  });

  it("does not retry recipients whose DM was already SENT", async () => {
    const noms = [
      nomination("U_A", "one", "n1"),
      nomination("U_B", "two", "n2"),
      nomination("U_A", "three", "n3"),
      nomination("U_B", "four", "n4"),
    ];
    const existing: ReportExecutionItem = {
      entityType: "REPORT_EXECUTION",
      workspaceId: "T1",
      periodStart: "2026-07-31T04:00:00.000Z",
      periodEnd: "2026-08-14T16:00:00.000Z",
      status: "PUBLISHED",
      winnerSlackIds: ["U_A", "U_B"],
      countsBySlackId: { U_A: 2, U_B: 2 },
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
          attempts: 1,
          lastAttemptAt: "2026-08-14T16:00:02.000Z",
        },
      ],
      retentionPolicy: "PUBLISHED_METADATA_INDEFINITE",
    };
    const h = harness({ nominations: noms, existingExecution: existing });

    await runReport(event(), h.deps);

    // Only U_B is DMed again; U_A is skipped.
    expect(h.slack.openDm).toHaveBeenCalledTimes(1);
    expect(h.slack.openDm.mock.calls[0]![0]).toEqual({
      userSlackId: "U_B",
      workspaceId: "T1",
    });
  });

  it("marks a DM as FAILED_RETRYABLE and still records PUBLISHED — a DM failure does not roll back publication", async () => {
    const noms = [
      nomination("U_A", "one", "n1"),
      nomination("U_A", "two", "n2"),
    ];
    const postMessage = vi
      .fn()
      // Public post succeeds.
      .mockResolvedValueOnce({ ts: "1725000000.000100", channel: RECOG })
      // Winner DM fails.
      .mockRejectedValueOnce(new Error("channel_not_found"));
    const h = harness({ nominations: noms, postMessageImpl: postMessage });

    await runReport(event(), h.deps);

    expect(h.reports.markPublished).toHaveBeenCalledTimes(1);
    expect(h.reports.updateDmDelivery).toHaveBeenCalledTimes(1);
    const delivery = h.reports.updateDmDelivery.mock.calls[0]![0]
      .delivery as WinnerDmDelivery;
    expect(delivery.status).toBe("FAILED_RETRYABLE");
    expect(delivery.attempts).toBe(1);
    expect(delivery.lastError).toBeDefined();
  });

  it("queries by the event's period boundaries, not the nomination stamp", async () => {
    const h = harness({ nominations: [] });

    await runReport(event(), h.deps);

    expect(h.nominations.queryByPeriod).toHaveBeenCalledWith({
      workspaceId: "T1",
      periodStartEpochMs: Date.parse("2026-07-31T04:00:00.000Z"),
      periodEndEpochMs: Date.parse("2026-08-14T16:00:00.000Z"),
    });
  });

  it("with forceRepublish=true, re-posts and re-DMs even when the row was already PUBLISHED and SENT", async () => {
    const noms = [
      nomination("U_A", "one", "n1"),
      nomination("U_A", "two", "n2"),
    ];
    const existing: ReportExecutionItem = {
      entityType: "REPORT_EXECUTION",
      workspaceId: "T1",
      periodStart: "2026-07-31T04:00:00.000Z",
      periodEnd: "2026-08-14T16:00:00.000Z",
      status: "PUBLISHED",
      winnerSlackIds: ["U_A"],
      countsBySlackId: { U_A: 2 },
      publicMessageTs: "1725000000.000100",
      publishedAt: "2026-08-14T16:00:01.000Z",
      dmDeliveries: [
        {
          recipientSlackId: "U_A",
          status: "SENT",
          attempts: 1,
          lastAttemptAt: "2026-08-14T16:00:02.000Z",
        },
      ],
      retentionPolicy: "PUBLISHED_METADATA_INDEFINITE",
    };
    const h = harness({ nominations: noms, existingExecution: existing });

    await runReport(event({ forceRepublish: true }), h.deps);

    // Admin path overwrites (not conditional put) so the fresh PENDING row
    // replaces the prior PUBLISHED/SENT state.
    expect(h.reports.overwritePendingExecution).toHaveBeenCalledTimes(1);
    expect(h.reports.putPendingExecution).not.toHaveBeenCalled();
    const overwritten = h.reports.overwritePendingExecution.mock
      .calls[0]![0] as ReportExecutionItem;
    expect(overwritten.status).toBe("PENDING");
    expect(overwritten.dmDeliveries).toEqual([
      { recipientSlackId: "U_A", status: "PENDING", attempts: 0 },
    ]);
    // Fresh public post + PUBLISHED update.
    expect(h.reports.markPublished).toHaveBeenCalledTimes(1);
    // Channel post + DM.
    expect(h.slack.postMessage).toHaveBeenCalledTimes(2);
    expect(h.slack.postMessage.mock.calls[0]![0].channel).toBe(RECOG);
    expect(h.slack.postMessage.mock.calls[1]![0].channel).toBe("D-U_A");
    const delivery = h.reports.updateDmDelivery.mock.calls[0]![0]
      .delivery as WinnerDmDelivery;
    expect(delivery.status).toBe("SENT");
    expect(delivery.attempts).toBe(1);
  });

  it("with forceRepublish=true and no existing row, behaves like a fresh scheduled run but via overwrite", async () => {
    const noms = [nomination("U_A", "one", "n1")];
    const h = harness({ nominations: noms });

    await runReport(event({ forceRepublish: true }), h.deps);

    expect(h.reports.overwritePendingExecution).toHaveBeenCalledTimes(1);
    expect(h.reports.putPendingExecution).not.toHaveBeenCalled();
    expect(h.reports.markPublished).toHaveBeenCalledTimes(1);
    expect(h.slack.postMessage).toHaveBeenCalledTimes(2);
  });
});
