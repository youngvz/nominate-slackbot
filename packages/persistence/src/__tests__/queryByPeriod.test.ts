import { describe, expect, it, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { NominationItem } from "@nominate/domain";
import { DEFAULT_GSI1_NAME, createNominationRepository } from "../index.js";
import { toNominationDdbItem } from "../mappers/nomination.js";

const TABLE = "test-table";
const WORKSPACE = "T1";

function makeItem(overrides: Partial<NominationItem>): NominationItem {
  const submittedAt =
    overrides.submittedAt ?? "2026-08-01T14:30:00.000Z";
  return {
    entityType: "NOMINATION",
    workspaceId: WORKSPACE,
    nominationId: "N-1",
    nominatorSlackId: "U_A",
    recipientSlackId: "U_B",
    description: "Nice work.",
    submittedAt,
    submittedAtEpochMs: Date.parse(submittedAt),
    reportPeriodStart: "2026-07-31T04:00:00.000Z",
    reportPeriodEnd: "2026-08-14T16:00:00.000Z",
    sourceType: "CHANNEL",
    status: "ACTIVE",
    retentionExpiresAt: 9_999_999_999,
    ...overrides,
  };
}

function stubClient(pages: unknown[][]): DynamoDBDocumentClient {
  let call = 0;
  return {
    send: vi.fn(async (_cmd: unknown) => {
      const items = pages[call] ?? [];
      const isLast = call >= pages.length - 1;
      call += 1;
      return {
        Items: items,
        ...(isLast ? {} : { LastEvaluatedKey: { PK: "x", SK: `page-${call}` } }),
      };
    }),
  } as unknown as DynamoDBDocumentClient;
}

describe("NominationRepository.queryByPeriod", () => {
  it("uses GSI1 with a BETWEEN range keyed on submitted-at epoch ms", async () => {
    const item = makeItem({ nominationId: "N-1" });
    const client = stubClient([[toNominationDdbItem(item)]]);
    const repo = createNominationRepository(client, TABLE, DEFAULT_GSI1_NAME);

    const periodStartEpochMs = Date.parse("2026-07-31T04:00:00.000Z");
    const periodEndEpochMs = Date.parse("2026-08-14T16:00:00.000Z");
    const results = await repo.queryByPeriod({
      workspaceId: WORKSPACE,
      periodStartEpochMs,
      periodEndEpochMs,
    });

    expect(results).toEqual([item]);
    const send = client.send as unknown as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0]![0] as QueryCommand;
    expect(cmd).toBeInstanceOf(QueryCommand);
    expect(cmd.input.TableName).toBe(TABLE);
    expect(cmd.input.IndexName).toBe(DEFAULT_GSI1_NAME);
    expect(cmd.input.KeyConditionExpression).toContain("GSI1PK = :pk");
    expect(cmd.input.KeyConditionExpression).toContain("BETWEEN");
    expect(cmd.input.ExpressionAttributeValues?.[":pk"]).toBe(
      `WORKSPACE#${WORKSPACE}#NOMINATIONS`,
    );
    expect(cmd.input.ExpressionAttributeValues?.[":lo"]).toBe(
      `${periodStartEpochMs}#`,
    );
    expect(cmd.input.ExpressionAttributeValues?.[":hi"]).toBe(
      `${periodEndEpochMs}#`,
    );
  });

  it("paginates through LastEvaluatedKey until exhausted", async () => {
    const first = makeItem({ nominationId: "N-1", submittedAt: "2026-08-01T00:00:00.000Z" });
    const second = makeItem({ nominationId: "N-2", submittedAt: "2026-08-02T00:00:00.000Z" });
    const client = stubClient([
      [toNominationDdbItem(first)],
      [toNominationDdbItem(second)],
    ]);
    const repo = createNominationRepository(client, TABLE, DEFAULT_GSI1_NAME);

    const results = await repo.queryByPeriod({
      workspaceId: WORKSPACE,
      periodStartEpochMs: Date.parse("2026-07-31T04:00:00.000Z"),
      periodEndEpochMs: Date.parse("2026-08-14T16:00:00.000Z"),
    });

    expect(results.map((r) => r.nominationId)).toEqual(["N-1", "N-2"]);
    const send = client.send as unknown as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledTimes(2);
    const second_call = send.mock.calls[1]![0] as QueryCommand;
    expect(second_call.input.ExclusiveStartKey).toBeDefined();
  });

  it("excludes submissions exactly at the period end (half-open interval)", async () => {
    const periodStart = Date.parse("2026-07-31T04:00:00.000Z");
    const periodEnd = Date.parse("2026-08-14T16:00:00.000Z");
    const inside = makeItem({
      nominationId: "N-in",
      submittedAt: new Date(periodEnd - 1).toISOString(),
    });
    const boundary = makeItem({
      nominationId: "N-bd",
      submittedAt: new Date(periodEnd).toISOString(),
    });
    const client = stubClient([
      [toNominationDdbItem(inside), toNominationDdbItem(boundary)],
    ]);
    const repo = createNominationRepository(client, TABLE, DEFAULT_GSI1_NAME);

    const results = await repo.queryByPeriod({
      workspaceId: WORKSPACE,
      periodStartEpochMs: periodStart,
      periodEndEpochMs: periodEnd,
    });

    expect(results.map((r) => r.nominationId)).toEqual(["N-in"]);
  });
});
