// docs/05 §Reminder execution + docs/10 §Weekly reminder.
export interface ReminderExecutionItem {
  entityType: "REMINDER_EXECUTION";
  workspaceId: string;
  scheduledAt: string;
  postedAt?: string;
  publicMessageTs?: string;
  status: "PENDING" | "POSTED" | "FAILED";
}
