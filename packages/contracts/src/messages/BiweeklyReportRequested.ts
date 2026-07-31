// Contract: docs/06-event-contracts.md §Report.
export interface BiweeklyReportRequestedV1 {
  eventType: "report.biweekly.requested";
  schemaVersion: 1;
  workspaceId: string;
  scheduledAt: string;
  periodStart: string;
  periodEnd: string;
  executionKey: string;
  // Admin-triggered on-demand runs set this to bypass the "already PUBLISHED"
  // idempotency guard so demos can re-post the report for the current period.
  // Scheduled EventBridge runs must never set this.
  forceRepublish?: boolean;
}
