# API and Event Contracts

## Contract principles

- Slack payloads are transport models, not domain models.
- Internal events are versioned.
- Every event includes workspace ID, correlation ID, idempotency key, and occurred-at time.
- Consumers must reject unsupported major versions.
- Do not place Slack secrets or full user profiles in events.

## Nomination submission event

```ts
interface NominationSubmissionRequestedV1 {
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
```

The SQS message body contains this contract. Message attributes may repeat `eventType`, `schemaVersion`, and `correlationId` for filtering and diagnostics.

## Domain result

```ts
type NominationResult =
  | {
      outcome: "ACCEPTED";
      nominationId: string;
      acceptedAt: string;
      nextEligibleAt: string;
    }
  | {
      outcome: "REJECTED_SELF_NOMINATION";
    }
  | {
      outcome: "REJECTED_INELIGIBLE_RECIPIENT";
      reason: "GUEST" | "EXTERNAL" | "BOT" | "DEACTIVATED" | "OTHER_WORKSPACE";
    }
  | {
      outcome: "REJECTED_REPEAT_WINDOW";
      nextEligibleAt: string;
    }
  | {
      outcome: "REJECTED_INVALID_DESCRIPTION";
      reason: "REQUIRED" | "TOO_SHORT" | "TOO_LONG";
    };
```

## Scheduled invocation contracts

### Reminder

```ts
interface WeeklyReminderRequestedV1 {
  eventType: "reminder.weekly.requested";
  schemaVersion: 1;
  workspaceId: string;
  scheduledAt: string;
  executionKey: string;
}
```

### Report

```ts
interface BiweeklyReportRequestedV1 {
  eventType: "report.biweekly.requested";
  schemaVersion: 1;
  workspaceId: string;
  scheduledAt: string;
  periodStart: string;
  periodEnd: string;
  executionKey: string;
}
```

## Error contract

Internal errors should be classified as:

- `VALIDATION_ERROR`
- `CONFLICT`
- `DEPENDENCY_RETRYABLE`
- `DEPENDENCY_NON_RETRYABLE`
- `CONFIGURATION_ERROR`
- `UNEXPECTED_ERROR`

Do not expose internal stack traces to Slack users. Return a stable, helpful message and retain the correlation ID in logs.

## SQS behavior

- Configure a DLQ.
- Use partial batch failure responses when batch size is greater than one.
- Keep batch size small for nomination processing unless load testing supports a larger value.
- Visibility timeout must exceed the Lambda timeout plus retry buffer.
- Poison messages must not block unrelated submissions.
