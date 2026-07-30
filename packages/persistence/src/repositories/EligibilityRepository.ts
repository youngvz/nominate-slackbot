import { type DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import type { EligibilityItem } from "@nominate/domain";
import { keys } from "../keys.js";
import { fromEligibilityDdbItem } from "../mappers/eligibility.js";

export interface EligibilityRepository {
  find(input: {
    workspaceId: string;
    nominatorSlackId: string;
    recipientSlackId: string;
  }): Promise<EligibilityItem | null>;
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
  };
}
