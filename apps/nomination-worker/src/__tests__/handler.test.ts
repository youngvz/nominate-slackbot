import { describe, expect, it, vi } from "vitest";
import { encodeEvent, type NominationSubmissionRequestedV1 } from "@nominate/contracts";
import { createLogger } from "@nominate/observability";
import type {
  EligibilityRepository,
  IdempotencyRepository,
  NominationRepository,
} from "@nominate/persistence";
import type { SlackClient } from "@nominate/slack";
import type { SQSRecord } from "aws-lambda";
import { handleBatch } from "../index.js";
import type { ProcessMessageDeps } from "../processMessage.js";

function recordFromEvent(
  event: NominationSubmissionRequestedV1,
  messageId: string,
): SQSRecord {
  const encoded = encodeEvent(event);
  return {
    messageId,
    receiptHandle: "rh",
    body: encoded.body,
    attributes: {
      ApproximateReceiveCount: "1",
      SentTimestamp: "0",
      SenderId: "sender",
      ApproximateFirstReceiveTimestamp: "0",
    },
    messageAttributes: {},
    md5OfBody: "",
    eventSource: "aws:sqs",
    eventSourceARN: "arn",
    awsRegion: "us-east-1",
  };
}

function makeEvent(idempotencyKey: string): NominationSubmissionRequestedV1 {
  return {
    eventType: "nomination.submission.requested",
    schemaVersion: 1,
    correlationId: "c",
    idempotencyKey,
    workspaceId: "T",
    nominatorSlackId: "U_A",
    recipientSlackId: "U_B",
    description: "Great work leading the migration this quarter.",
    sourceType: "CHANNEL",
    responseContext: { submittedAt: "2026-08-01T14:30:00.000Z" },
  };
}

interface Deps extends ProcessMessageDeps {
  logger: ReturnType<typeof createLogger>;
}

function deps(overrides: Partial<{
  acceptImpl: NominationRepository["acceptNomination"];
}> = {}): Deps {
  const eligibility: EligibilityRepository = { find: vi.fn().mockResolvedValue(null) };
  const nominations: NominationRepository = {
    acceptNomination:
      overrides.acceptImpl ??
      vi.fn(async ({ nomination }) => ({
        outcome: "ACCEPTED" as const,
        nominationId: nomination.nominationId,
        acceptedAt: nomination.submittedAt,
        nextEligibleAt: nomination.submittedAt,
      })),
    findById: vi.fn(),
    queryByPeriod: vi.fn(),
  };
  const idempotency: IdempotencyRepository = {
    lookup: vi.fn().mockResolvedValue(null),
    store: vi.fn().mockResolvedValue(undefined),
  };
  const slack: SlackClient = {
    getUser: vi.fn().mockResolvedValue({
      id: "U_B",
      team_id: "T",
      is_bot: false,
      is_app_user: false,
      is_restricted: false,
      is_ultra_restricted: false,
      deleted: false,
    }),
    openDm: vi.fn().mockResolvedValue({ channel: "D" }),
    postMessage: vi.fn().mockResolvedValue({ ts: "1.0", channel: "D" }),
    openView: vi.fn(),
  };
  return {
    nominations,
    eligibility,
    idempotency,
    slack,
    recognitionChannelId: "C",
    logger: createLogger({ service: "test", environment: "test" }),
    now: () => Date.parse("2026-08-01T14:30:00.000Z"),
    newNominationId: () => "N-1",
  };
}

describe("nomination-worker handleBatch", () => {
  it("returns no failures when every record succeeds", async () => {
    const d = deps();
    const res = await handleBatch(
      [recordFromEvent(makeEvent("A"), "m-1"), recordFromEvent(makeEvent("B"), "m-2")],
      d,
    );
    expect(res.batchItemFailures).toEqual([]);
  });

  it("marks only the failing record for retry (partial batch failure)", async () => {
    const failing = vi
      .fn()
      .mockResolvedValueOnce({
        outcome: "ACCEPTED" as const,
        nominationId: "N-1",
        acceptedAt: "2026-08-01T14:30:00.000Z",
        nextEligibleAt: "2026-08-15T14:30:00.000Z",
      })
      .mockRejectedValueOnce(new Error("dynamo blew up"));
    const d = deps({ acceptImpl: failing });

    const res = await handleBatch(
      [recordFromEvent(makeEvent("A"), "m-1"), recordFromEvent(makeEvent("B"), "m-2")],
      d,
    );

    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "m-2" }]);
  });

  it("drops (does not retry) messages with unsupported schema versions", async () => {
    const d = deps();
    const bad: SQSRecord = {
      ...recordFromEvent(makeEvent("A"), "m-1"),
      body: JSON.stringify({ schemaVersion: 99, eventType: "nomination.submission.requested" }),
    };

    const res = await handleBatch([bad], d);
    expect(res.batchItemFailures).toEqual([]);
    expect(d.nominations.acceptNomination).not.toHaveBeenCalled();
  });

  it("drops messages with malformed JSON without failing the batch", async () => {
    const d = deps();
    const bad: SQSRecord = {
      ...recordFromEvent(makeEvent("A"), "m-1"),
      body: "{not-json",
    };

    const res = await handleBatch([bad], d);
    expect(res.batchItemFailures).toEqual([]);
  });
});
