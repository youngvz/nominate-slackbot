import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import {
  type DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { EligibilityItem, NominationItem, NominationResult } from "@nominate/domain";
import { computeNextEligibleAtEpoch } from "@nominate/domain";
import { NotImplementedError } from "@nominate/observability";
import { keys } from "../keys.js";
import { toEligibilityDdbItem } from "../mappers/eligibility.js";
import { fromNominationDdbItem, toNominationDdbItem } from "../mappers/nomination.js";

// docs/05 §Atomic nomination transaction + docs/02 §Concurrency rule.
// Executes TransactWriteItems: put nomination + put/update eligibility with the
// condition:  attribute_not_exists(PK) OR nextEligibleAtEpoch <= :now
// The two writes must succeed or fail as a unit.
export interface AcceptNominationInput {
  nomination: NominationItem;
  nowEpochMs: number;
  interactionId?: string;
}

export interface NominationRepository {
  acceptNomination(input: AcceptNominationInput): Promise<NominationResult>;
  findById(nominationId: string): Promise<NominationItem | null>;
  queryByPeriod(input: {
    workspaceId: string;
    periodStartEpochMs: number;
    periodEndEpochMs: number;
  }): Promise<NominationItem[]>;
}

// TTL is a cleanup mechanism; correctness uses nextEligibleAtEpoch. We pad the
// TTL a little past the window so that a still-restricted item can't be
// deleted before nextEligibleAt is reached.
const ELIGIBILITY_TTL_PAD_SECONDS = 60;

function eligibilityFrom(nomination: NominationItem): EligibilityItem {
  const acceptedAtEpoch = nomination.submittedAtEpochMs;
  const nextEligibleAtEpoch = computeNextEligibleAtEpoch(acceptedAtEpoch);
  return {
    entityType: "ELIGIBILITY",
    workspaceId: nomination.workspaceId,
    nominatorSlackId: nomination.nominatorSlackId,
    recipientSlackId: nomination.recipientSlackId,
    nominationId: nomination.nominationId,
    acceptedAt: nomination.submittedAt,
    nextEligibleAt: new Date(nextEligibleAtEpoch).toISOString(),
    nextEligibleAtEpoch,
    ttl: Math.floor(nextEligibleAtEpoch / 1000) + ELIGIBILITY_TTL_PAD_SECONDS,
  };
}

export function createNominationRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
  gsi1Name: string,
): NominationRepository {
  return {
    async acceptNomination({ nomination, nowEpochMs }) {
      const eligibility = eligibilityFrom(nomination);

      try {
        await client.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: toNominationDdbItem(nomination),
                  ConditionExpression: "attribute_not_exists(PK)",
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: toEligibilityDdbItem(eligibility),
                  ConditionExpression:
                    "attribute_not_exists(PK) OR nextEligibleAtEpoch <= :now",
                  ExpressionAttributeValues: { ":now": nowEpochMs },
                },
              },
            ],
          }),
        );
      } catch (err) {
        if (err instanceof TransactionCanceledException) {
          const reasons = err.CancellationReasons ?? [];
          const eligibilityCancel = reasons[1];
          if (eligibilityCancel?.Code === "ConditionalCheckFailed") {
            const nextEligibleAt = await readNextEligibleAt(
              client,
              tableName,
              nomination.workspaceId,
              nomination.nominatorSlackId,
              nomination.recipientSlackId,
            );
            return {
              outcome: "REJECTED_REPEAT_WINDOW",
              nextEligibleAt: nextEligibleAt ?? eligibility.nextEligibleAt,
            };
          }
        }
        throw err;
      }

      return {
        outcome: "ACCEPTED",
        nominationId: nomination.nominationId,
        acceptedAt: nomination.submittedAt,
        nextEligibleAt: eligibility.nextEligibleAt,
      };
    },

    async findById(_nominationId) {
      throw new NotImplementedError("NominationRepository.findById");
    },

    async queryByPeriod({ workspaceId, periodStartEpochMs, periodEndEpochMs }) {
      // docs/05 §Reporting index. GSI1SK is `{submittedAtEpochMs}#{nominationId}`,
      // so a lexicographic `BETWEEN` over strings padded to the same width as the
      // stored values yields the same order as numeric epoch-ms comparison. We
      // exclude items exactly at periodEndEpochMs (docs/02 §Reporting periods).
      const lower = keys.gsi1Sk(periodStartEpochMs, "");
      const upper = keys.gsi1Sk(periodEndEpochMs, "");

      const items: NominationItem[] = [];
      let exclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const res = await client.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: gsi1Name,
            KeyConditionExpression:
              "GSI1PK = :pk AND GSI1SK BETWEEN :lo AND :hi",
            ExpressionAttributeValues: {
              ":pk": keys.gsi1Pk(workspaceId),
              ":lo": lower,
              ":hi": upper,
            },
            ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
          }),
        );
        for (const raw of res.Items ?? []) {
          const item = fromNominationDdbItem(raw as Record<string, unknown>);
          if (
            item.submittedAtEpochMs >= periodStartEpochMs &&
            item.submittedAtEpochMs < periodEndEpochMs
          ) {
            items.push(item);
          }
        }
        exclusiveStartKey = res.LastEvaluatedKey as
          | Record<string, unknown>
          | undefined;
      } while (exclusiveStartKey);
      return items;
    },
  };
}

async function readNextEligibleAt(
  client: DynamoDBDocumentClient,
  tableName: string,
  workspaceId: string,
  nominatorSlackId: string,
  recipientSlackId: string,
): Promise<string | undefined> {
  const res = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: keys.eligibilityPK(workspaceId, nominatorSlackId),
        SK: keys.eligibilitySK(recipientSlackId),
      },
      ProjectionExpression: "nextEligibleAt",
    }),
  );
  const value = res.Item?.nextEligibleAt;
  return typeof value === "string" ? value : undefined;
}
