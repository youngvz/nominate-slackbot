import { describe, expect, it, vi } from "vitest";
import type { WeeklyReminderRequestedV1 } from "@nominate/contracts";
import type { ReminderExecutionItem } from "@nominate/domain";
import { createLogger } from "@nominate/observability";
import type { ReminderRepository } from "@nominate/persistence";
import type { SlackClient } from "@nominate/slack";
import { postReminder, type PostReminderDeps } from "../postReminder.js";

const RECOG = "C_RECOG";
const NOW = Date.UTC(2026, 7, 7, 13, 0, 1);

function event(
  overrides: Partial<WeeklyReminderRequestedV1> = {},
): WeeklyReminderRequestedV1 {
  return {
    eventType: "reminder.weekly.requested",
    schemaVersion: 1,
    workspaceId: "T1",
    scheduledAt: "2026-08-07T13:00:00.000Z",
    executionKey: "T1#2026-08-07T13:00:00.000Z",
    ...overrides,
  };
}

interface Harness {
  deps: PostReminderDeps;
  reminders: {
    claim: ReturnType<typeof vi.fn>;
    markPosted: ReturnType<typeof vi.fn>;
  };
  slack: {
    postMessage: ReturnType<typeof vi.fn>;
    openView: ReturnType<typeof vi.fn>;
    openDm: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
  };
}

function harness(
  overrides: Partial<{
    claimImpl: ReminderRepository["claim"];
    postMessageImpl: SlackClient["postMessage"];
  }> = {},
): Harness {
  const reminders: ReminderRepository = {
    claim:
      overrides.claimImpl ??
      vi.fn().mockResolvedValue({ claimed: true }),
    markPosted: vi.fn().mockResolvedValue(undefined),
  };
  const slack: SlackClient = {
    postMessage:
      overrides.postMessageImpl ??
      vi.fn().mockResolvedValue({ ts: "1754571600.000100", channel: RECOG }),
    openView: vi.fn(),
    openDm: vi.fn(),
    getUser: vi.fn(),
  };
  const deps: PostReminderDeps = {
    reminders,
    slack,
    recognitionChannelId: RECOG,
    logger: createLogger({ service: "test", environment: "test" }),
    now: () => NOW,
  };
  return {
    deps,
    reminders: reminders as never,
    slack: slack as never,
  };
}

describe("postReminder", () => {
  it("claims the row, posts the reminder to the recognition channel, and marks posted", async () => {
    const h = harness();

    await postReminder(event(), h.deps);

    // Claim recorded a PENDING row keyed by scheduledAt.
    expect(h.reminders.claim).toHaveBeenCalledTimes(1);
    const claimed = h.reminders.claim.mock.calls[0]![0] as ReminderExecutionItem;
    expect(claimed.entityType).toBe("REMINDER_EXECUTION");
    expect(claimed.status).toBe("PENDING");
    expect(claimed.workspaceId).toBe("T1");
    expect(claimed.scheduledAt).toBe("2026-08-07T13:00:00.000Z");

    // Public post landed on the recognition channel and encourages /nominate
    // without leaking secrets or user-specific data.
    expect(h.slack.postMessage).toHaveBeenCalledTimes(1);
    const post = h.slack.postMessage.mock.calls[0]![0] as {
      channel: string;
      text: string;
    };
    expect(post.channel).toBe(RECOG);
    expect(post.text).toContain("/nominate");

    // markPosted records the Slack ts + now() timestamp.
    expect(h.reminders.markPosted).toHaveBeenCalledTimes(1);
    expect(h.reminders.markPosted.mock.calls[0]![0]).toEqual({
      workspaceId: "T1",
      scheduledAt: "2026-08-07T13:00:00.000Z",
      publicMessageTs: "1754571600.000100",
      postedAt: new Date(NOW).toISOString(),
    });
  });

  it("skips posting when the row was already claimed by a prior invocation", async () => {
    const h = harness({
      claimImpl: vi.fn().mockResolvedValue({ claimed: false }),
    });

    await postReminder(event(), h.deps);

    expect(h.reminders.claim).toHaveBeenCalledTimes(1);
    expect(h.slack.postMessage).not.toHaveBeenCalled();
    expect(h.reminders.markPosted).not.toHaveBeenCalled();
  });

  it("re-throws when Slack post fails after a successful claim (retry short-circuits on next invocation)", async () => {
    const postError = new Error("channel_not_found");
    const h = harness({
      postMessageImpl: vi.fn().mockRejectedValue(postError),
    });

    await expect(postReminder(event(), h.deps)).rejects.toThrow(postError);
    expect(h.reminders.claim).toHaveBeenCalledTimes(1);
    expect(h.slack.postMessage).toHaveBeenCalledTimes(1);
    expect(h.reminders.markPosted).not.toHaveBeenCalled();
  });
});
