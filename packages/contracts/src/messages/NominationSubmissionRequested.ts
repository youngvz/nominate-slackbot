// Contract: docs/06-event-contracts.md §Nomination submission event.
export interface NominationSubmissionRequestedV1 {
  eventType: "nomination.submission.requested";
  schemaVersion: 1;
  correlationId: string;
  idempotencyKey: string;
  workspaceId: string;
  nominatorSlackId: string;
  recipientSlackId: string;
  description: string;
  sourceChannelId?: string;
  sourceType: "CHANNEL" | "DM";
  responseContext: {
    responseUrl?: string;
    submittedAt: string;
  };
}
