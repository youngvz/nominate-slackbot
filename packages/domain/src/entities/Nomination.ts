// docs/05-dynamodb-data-model.md §Nomination.
export interface NominationItem {
  entityType: "NOMINATION";
  workspaceId: string;
  nominationId: string;
  nominatorSlackId: string;
  recipientSlackId: string;
  description: string;
  submittedAt: string;
  submittedAtEpochMs: number;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  sourceChannelId?: string;
  sourceType: "CHANNEL" | "DM";
  status: "ACTIVE";
  retentionExpiresAt: number;
}

// docs/06-event-contracts.md §Domain result.
export type NominationResult =
  | { outcome: "ACCEPTED"; nominationId: string; acceptedAt: string; nextEligibleAt: string }
  | { outcome: "REJECTED_SELF_NOMINATION" }
  | {
      outcome: "REJECTED_INELIGIBLE_RECIPIENT";
      reason: "GUEST" | "EXTERNAL" | "BOT" | "DEACTIVATED" | "OTHER_WORKSPACE";
    }
  | { outcome: "REJECTED_REPEAT_WINDOW"; nextEligibleAt: string }
  | {
      outcome: "REJECTED_INVALID_DESCRIPTION";
      reason: "REQUIRED" | "TOO_SHORT" | "TOO_LONG";
    };
