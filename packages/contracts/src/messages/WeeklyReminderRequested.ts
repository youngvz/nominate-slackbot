// Contract: docs/06-event-contracts.md §Reminder.
export interface WeeklyReminderRequestedV1 {
  eventType: "reminder.weekly.requested";
  schemaVersion: 1;
  workspaceId: string;
  scheduledAt: string;
  executionKey: string;
}
