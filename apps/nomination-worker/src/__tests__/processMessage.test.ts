import { describe, expect, it, vi } from "vitest";
import type { NominationSubmissionRequestedV1 } from "@nominate/contracts";
import type { EligibilityItem, NominationResult } from "@nominate/domain";
import { createLogger } from "@nominate/observability";
import type {
  AcceptNominationInput,
  EligibilityRepository,
  IdempotencyRepository,
  NominationRepository,
} from "@nominate/persistence";
import type { SlackClient } from "@nominate/slack";
import { processMessage, type ProcessMessageDeps } from "../processMessage.js";

const NOW_MS = Date.UTC(2026, 7, 1, 14, 30);

function baseEvent(
  overrides: Partial<NominationSubmissionRequestedV1> = {},
): NominationSubmissionRequestedV1 {
  return {
    eventType: "nomination.submission.requested",
    schemaVersion: 1,
    correlationId: "corr-1",
    idempotencyKey: "T_TEAM:V_VIEW",
    workspaceId: "T_TEAM",
    nominatorSlackId: "U_A",
    recipientSlackId: "U_B",
    description: "Great work leading the migration this quarter.",
    sourceType: "CHANNEL",
    responseContext: { submittedAt: new Date(NOW_MS).toISOString() },
    ...overrides,
  };
}

function slackUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "U_B",
    team_id: "T_TEAM",
    is_bot: false,
    is_app_user: false,
    is_restricted: false,
    is_ultra_restricted: false,
    deleted: false,
    ...overrides,
  };
}

interface Harness {
  deps: ProcessMessageDeps;
  slack: {
    getUser: ReturnType<typeof vi.fn>;
    openDm: ReturnType<typeof vi.fn>;
    postMessage: ReturnType<typeof vi.fn>;
    openView: ReturnType<typeof vi.fn>;
  };
  nominations: {
    acceptNomination: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    queryByPeriod: ReturnType<typeof vi.fn>;
  };
  eligibility: { find: ReturnType<typeof vi.fn> };
  idempotency: {
    lookup: ReturnType<typeof vi.fn>;
    store: ReturnType<typeof vi.fn>;
  };
}

function harness(overrides: Partial<{
  cachedResult: NominationResult | null;
  existingEligibility: EligibilityItem | null;
  acceptResult: NominationResult;
  slackUser: Record<string, unknown>;
  now: number;
}> = {}): Harness {
  const cached = overrides.cachedResult ?? null;
  const idempotency: IdempotencyRepository = {
    lookup: vi.fn().mockResolvedValue(cached),
    store: vi.fn().mockResolvedValue(undefined),
  };
  const eligibility: EligibilityRepository = {
    find: vi.fn().mockResolvedValue(overrides.existingEligibility ?? null),
  };
  const nominations: NominationRepository = {
    acceptNomination: vi
      .fn()
      .mockImplementation(async ({ nomination }: AcceptNominationInput) => {
        return (
          overrides.acceptResult ?? {
            outcome: "ACCEPTED",
            nominationId: nomination.nominationId,
            acceptedAt: nomination.submittedAt,
            nextEligibleAt: new Date(
              nomination.submittedAtEpochMs + 14 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }
        );
      }),
    findById: vi.fn(),
    queryByPeriod: vi.fn(),
  };
  const slack: SlackClient = {
    getUser: vi.fn().mockResolvedValue(overrides.slackUser ?? slackUser()),
    openDm: vi.fn().mockResolvedValue({ channel: "D1" }),
    postMessage: vi.fn().mockResolvedValue({ ts: "1.0", channel: "D1" }),
    openView: vi.fn(),
  };
  const deps: ProcessMessageDeps = {
    nominations,
    eligibility,
    idempotency,
    slack,
    recognitionChannelId: "C_RECOG",
    logger: createLogger({ service: "test", environment: "test" }),
    now: () => overrides.now ?? NOW_MS,
    newNominationId: () => "N-1",
  };
  return {
    deps,
    slack: slack as never,
    nominations: nominations as never,
    eligibility: eligibility as never,
    idempotency: idempotency as never,
  };
}

describe("processMessage", () => {
  it("accepts a valid nomination end-to-end", async () => {
    const h = harness();
    const result = await processMessage(baseEvent(), h.deps);

    expect(result.outcome).toBe("ACCEPTED");
    expect(h.slack.getUser).toHaveBeenCalledWith({
      userSlackId: "U_B",
      workspaceId: "T_TEAM",
    });
    expect(h.nominations.acceptNomination).toHaveBeenCalledTimes(1);
    const call = h.nominations.acceptNomination.mock.calls[0]![0] as AcceptNominationInput;
    expect(call.nomination.status).toBe("ACTIVE");
    expect(call.nomination.nominationId).toBe("N-1");
    expect(call.nomination.description).toBe(
      "Great work leading the migration this quarter.",
    );
    expect(call.nomination.workspaceId).toBe("T_TEAM");
    expect(call.nomination.submittedAtEpochMs).toBe(NOW_MS);
    expect(h.slack.postMessage).toHaveBeenCalledTimes(1);
    const dmText = h.slack.postMessage.mock.calls[0]![0].text as string;
    expect(dmText).toMatch(/recorded/i);
    expect(h.idempotency.store).toHaveBeenCalledTimes(1);
  });

  it("returns the cached result on replay and does not re-persist", async () => {
    const cached: NominationResult = { outcome: "REJECTED_SELF_NOMINATION" };
    const h = harness({ cachedResult: cached });

    const result = await processMessage(baseEvent(), h.deps);

    expect(result).toEqual(cached);
    expect(h.nominations.acceptNomination).not.toHaveBeenCalled();
    expect(h.eligibility.find).not.toHaveBeenCalled();
    expect(h.slack.getUser).not.toHaveBeenCalled();
    expect(h.idempotency.store).not.toHaveBeenCalled();
  });

  it("rejects a self-nomination without touching Slack or persistence", async () => {
    const h = harness();
    const result = await processMessage(
      baseEvent({ recipientSlackId: "U_A" }),
      h.deps,
    );

    expect(result).toEqual({ outcome: "REJECTED_SELF_NOMINATION" });
    expect(h.slack.getUser).not.toHaveBeenCalled();
    expect(h.nominations.acceptNomination).not.toHaveBeenCalled();
    expect(h.idempotency.store).toHaveBeenCalledTimes(1);
  });

  it("rejects a too-short description", async () => {
    const h = harness();
    const result = await processMessage(
      baseEvent({ description: "short" }),
      h.deps,
    );

    expect(result).toEqual({
      outcome: "REJECTED_INVALID_DESCRIPTION",
      reason: "TOO_SHORT",
    });
    expect(h.nominations.acceptNomination).not.toHaveBeenCalled();
  });

  it("rejects a bot recipient", async () => {
    const h = harness({ slackUser: slackUser({ is_bot: true }) });
    const result = await processMessage(baseEvent(), h.deps);
    expect(result).toEqual({ outcome: "REJECTED_INELIGIBLE_RECIPIENT", reason: "BOT" });
    expect(h.nominations.acceptNomination).not.toHaveBeenCalled();
  });

  it("rejects a guest recipient", async () => {
    const h = harness({ slackUser: slackUser({ is_restricted: true }) });
    const result = await processMessage(baseEvent(), h.deps);
    expect(result).toEqual({ outcome: "REJECTED_INELIGIBLE_RECIPIENT", reason: "GUEST" });
  });

  it("rejects when an unexpired eligibility record still restricts the pair", async () => {
    const nextEligibleAtEpoch = NOW_MS + 60_000;
    const existing: EligibilityItem = {
      entityType: "ELIGIBILITY",
      workspaceId: "T_TEAM",
      nominatorSlackId: "U_A",
      recipientSlackId: "U_B",
      nominationId: "N-prev",
      acceptedAt: new Date(NOW_MS - 1_000).toISOString(),
      nextEligibleAt: new Date(nextEligibleAtEpoch).toISOString(),
      nextEligibleAtEpoch,
      ttl: Math.floor(nextEligibleAtEpoch / 1000) + 60,
    };
    const h = harness({ existingEligibility: existing });
    const result = await processMessage(baseEvent(), h.deps);

    expect(result).toEqual({
      outcome: "REJECTED_REPEAT_WINDOW",
      nextEligibleAt: existing.nextEligibleAt,
    });
    expect(h.nominations.acceptNomination).not.toHaveBeenCalled();
  });

  it("proceeds to acceptNomination when the stored eligibility has already expired", async () => {
    const nextEligibleAtEpoch = NOW_MS - 1;
    const stale: EligibilityItem = {
      entityType: "ELIGIBILITY",
      workspaceId: "T_TEAM",
      nominatorSlackId: "U_A",
      recipientSlackId: "U_B",
      nominationId: "N-old",
      acceptedAt: new Date(NOW_MS - WINDOW).toISOString(),
      nextEligibleAt: new Date(nextEligibleAtEpoch).toISOString(),
      nextEligibleAtEpoch,
      ttl: Math.floor(nextEligibleAtEpoch / 1000) + 60,
    };
    const h = harness({ existingEligibility: stale });
    const result = await processMessage(baseEvent(), h.deps);

    expect(result.outcome).toBe("ACCEPTED");
    expect(h.nominations.acceptNomination).toHaveBeenCalledTimes(1);
  });

  it("does not fail the message when the feedback DM cannot be sent", async () => {
    const h = harness();
    h.slack.postMessage.mockRejectedValueOnce(new Error("chat.postMessage failed"));

    const result = await processMessage(baseEvent(), h.deps);

    expect(result.outcome).toBe("ACCEPTED");
    expect(h.idempotency.store).toHaveBeenCalledTimes(1);
  });
});

const WINDOW = 14 * 24 * 60 * 60 * 1000;
