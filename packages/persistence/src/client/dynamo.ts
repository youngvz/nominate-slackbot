import { NotImplementedError } from "@nominate/observability";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface DynamoConfig {
  region: string;
  tableName: string;
  gsi1Name?: string;
  endpoint?: string;
}

export const DEFAULT_GSI1_NAME = "GSI1";

export function createDynamoClient(_cfg: DynamoConfig): DynamoDBDocumentClient {
  throw new NotImplementedError("createDynamoClient");
}
