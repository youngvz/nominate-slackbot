import { type DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { NominationResult } from "@nominate/domain";
import { keys } from "../keys.js";

// docs/05 §Idempotency. Slack modal replays must return the original result.
export interface IdempotencyRepository {
  lookup(input: { workspaceId: string; interactionId: string }): Promise<NominationResult | null>;
  store(input: {
    workspaceId: string;
    interactionId: string;
    result: NominationResult;
    ttlEpochSec: number;
  }): Promise<void>;
}

export function createIdempotencyRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): IdempotencyRepository {
  return {
    async lookup({ workspaceId, interactionId }) {
      const res = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: keys.idempotencyPK(workspaceId),
            SK: keys.idempotencySK(interactionId),
          },
          ProjectionExpression: "#r",
          ExpressionAttributeNames: { "#r": "result" },
        }),
      );
      const stored = res.Item?.result;
      if (!stored || typeof stored !== "object") return null;
      return stored as NominationResult;
    },

    async store({ workspaceId, interactionId, result, ttlEpochSec }) {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            PK: keys.idempotencyPK(workspaceId),
            SK: keys.idempotencySK(interactionId),
            entityType: "IDEMPOTENCY",
            workspaceId,
            interactionId,
            result,
            ttl: ttlEpochSec,
          },
        }),
      );
    },
  };
}
