import { NotImplementedError } from "@nominate/observability";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { EligibilityItem } from "@nominate/domain";

export interface EligibilityRepository {
  find(input: {
    workspaceId: string;
    nominatorSlackId: string;
    recipientSlackId: string;
  }): Promise<EligibilityItem | null>;
}

export function createEligibilityRepository(
  _client: DynamoDBDocumentClient,
  _tableName: string,
): EligibilityRepository {
  throw new NotImplementedError("createEligibilityRepository");
}
