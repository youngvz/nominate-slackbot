import {
  type DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { EligibilityItem } from "@nominate/domain";
import { keys } from "../keys.js";
import { fromEligibilityDdbItem } from "../mappers/eligibility.js";

export interface EligibilityRepository {
  find(input: {
    workspaceId: string;
    nominatorSlackId: string;
    recipientSlackId: string;
  }): Promise<EligibilityItem | null>;
  // Returns every eligibility record for one nominator regardless of window
  // state; callers filter by nextEligibleAtEpoch. TTL-expired items may still
  // appear until DynamoDB reaps them (docs/05 §Retention), so filtering by
  // wall time is required for correctness.
  listByNominator(input: {
    workspaceId: string;
    nominatorSlackId: string;
  }): Promise<EligibilityItem[]>;
}

export function createEligibilityRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): EligibilityRepository {
  return {
    async find({ workspaceId, nominatorSlackId, recipientSlackId }) {
      const res = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: keys.eligibilityPK(workspaceId, nominatorSlackId),
            SK: keys.eligibilitySK(recipientSlackId),
          },
        }),
      );
      if (!res.Item) return null;
      return fromEligibilityDdbItem(res.Item as Record<string, unknown>);
    },

    async listByNominator({ workspaceId, nominatorSlackId }) {
      const res = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
          ExpressionAttributeValues: {
            ":pk": keys.eligibilityPK(workspaceId, nominatorSlackId),
            ":sk": "RECIPIENT#",
          },
        }),
      );
      const items = res.Items ?? [];
      return items.map((item) => fromEligibilityDdbItem(item as Record<string, unknown>));
    },
  };
}
