import { NotImplementedError } from "@nominate/observability";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { NominationItem, NominationResult } from "@nominate/domain";

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

export function createNominationRepository(
  _client: DynamoDBDocumentClient,
  _tableName: string,
  _gsi1Name: string,
): NominationRepository {
  throw new NotImplementedError("createNominationRepository");
}
