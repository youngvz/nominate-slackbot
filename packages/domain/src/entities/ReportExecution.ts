// docs/05 §Report execution and docs/10 §Idempotency state.
export type ReportStatus =
  | "PENDING"
  | "PUBLISHED"
  | "PARTIAL_DM_FAILURE"
  | "COMPLETED"
  | "FAILED";

export type DmDeliveryStatus = "PENDING" | "SENT" | "FAILED_RETRYABLE" | "FAILED_TERMINAL";

export interface WinnerDmDelivery {
  recipientSlackId: string;
  status: DmDeliveryStatus;
  lastAttemptAt?: string;
  attempts: number;
  lastError?: string;
}

export interface ReportExecutionItem {
  entityType: "REPORT_EXECUTION";
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  status: ReportStatus;
  winnerSlackIds: string[];
  countsBySlackId: Record<string, number>;
  publicMessageTs?: string;
  publishedAt?: string;
  dmDeliveries: WinnerDmDelivery[];
  retentionPolicy: "PUBLISHED_METADATA_INDEFINITE";
}
