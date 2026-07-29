// Contract: docs/06-event-contracts.md §Report.
export interface BiweeklyReportRequestedV1 {
  eventType: "report.biweekly.requested";
  schemaVersion: 1;
  workspaceId: string;
  scheduledAt: string;
  periodStart: string;
  periodEnd: string;
  executionKey: string;
}
