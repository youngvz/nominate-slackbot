import { NotImplementedError } from "@nominate/observability";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { AuditEventItem } from "@nominate/domain";

export interface AuditRepository {
  append(event: AuditEventItem): Promise<void>;
}

export function createAuditRepository(
  _client: DynamoDBDocumentClient,
  _tableName: string,
): AuditRepository {
  throw new NotImplementedError("createAuditRepository");
}
