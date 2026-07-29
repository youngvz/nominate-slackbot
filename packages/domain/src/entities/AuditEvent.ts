// docs/05 §Audit event + docs/09 §Auditability. Never duplicate full descriptions
// into audit events without a defined need.
export type AuditEventType =
  | "NOMINATION_ACCEPTED"
  | "NOMINATION_REJECTED"
  | "REPORT_PUBLISHED"
  | "REMINDER_POSTED"
  | "WINNER_DM_SENT"
  | "WINNER_DM_FAILED";

export interface AuditEventItem {
  entityType: "AUDIT_EVENT";
  workspaceId: string;
  eventId: string;
  eventType: AuditEventType;
  occurredAt: string;
  occurredAtEpochMs: number;
  correlationId?: string;
  actorSlackId?: string;
  subjectSlackId?: string;
  metadata?: Record<string, string | number | boolean>;
}
