import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface DynamoConfig {
  region: string;
  tableName: string;
  gsi1Name?: string;
  endpoint?: string;
}

export const DEFAULT_GSI1_NAME = "GSI1";

export function createDynamoClient(cfg: DynamoConfig): DynamoDBDocumentClient {
  const base = new DynamoDBClient({
    region: cfg.region,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
  });
  return DynamoDBDocumentClient.from(base, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: false,
    },
  });
}
