// PK/SK builders. Definitions are the source of truth from
// docs/05-dynamodb-data-model.md §Entity patterns.

export const keys = {
  nominationPK: (workspaceId: string) => `WORKSPACE#${workspaceId}`,
  nominationSK: (submittedAtEpochMs: number, nominationId: string) =>
    `NOMINATION#${submittedAtEpochMs}#${nominationId}`,

  eligibilityPK: (workspaceId: string, nominatorSlackId: string) =>
    `ELIGIBILITY#${workspaceId}#${nominatorSlackId}`,
  eligibilitySK: (recipientSlackId: string) => `RECIPIENT#${recipientSlackId}`,

  reportPK: (workspaceId: string) => `WORKSPACE#${workspaceId}`,
  reportSK: (periodStart: string) => `REPORT#${periodStart}`,

  reminderPK: (workspaceId: string) => `WORKSPACE#${workspaceId}`,
  reminderSK: (scheduledAt: string) => `REMINDER#${scheduledAt}`,

  auditPK: (workspaceId: string) => `AUDIT#${workspaceId}`,
  auditSK: (occurredAtEpochMs: number, eventId: string) =>
    `EVENT#${occurredAtEpochMs}#${eventId}`,

  idempotencyPK: (workspaceId: string) => `IDEMPOTENCY#${workspaceId}`,
  idempotencySK: (interactionId: string) => `SLACK#${interactionId}`,

  gsi1Pk: (workspaceId: string) => `WORKSPACE#${workspaceId}#NOMINATIONS`,
  gsi1Sk: (submittedAtEpochMs: number, nominationId: string) =>
    `${submittedAtEpochMs}#${nominationId}`,
} as const;
