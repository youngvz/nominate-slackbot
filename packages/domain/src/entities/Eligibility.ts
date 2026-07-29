// docs/05-dynamodb-data-model.md §Eligibility lock.
export interface EligibilityItem {
  entityType: "ELIGIBILITY";
  workspaceId: string;
  nominatorSlackId: string;
  recipientSlackId: string;
  nominationId: string;
  acceptedAt: string;
  nextEligibleAt: string;
  nextEligibleAtEpoch: number;
  ttl: number;
}
