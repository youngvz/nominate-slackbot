import { NotImplementedError } from "@nominate/observability";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { NominationResult } from "@nominate/domain";

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
  _client: DynamoDBDocumentClient,
  _tableName: string,
): IdempotencyRepository {
  throw new NotImplementedError("createIdempotencyRepository");
}
