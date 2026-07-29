# Testing Strategy

## Testing layers

### Domain unit tests

Cover:

- Self-nomination rejection.
- Guest rejection.
- Slack Connect/external rejection.
- Bot rejection.
- Deactivated-user rejection.
- Description trimming and boundaries.
- Rolling 14-day calculations.
- Exact eligibility boundary acceptance.
- Report period boundaries.
- Count-based winners and ties.
- Empty reporting periods.

### DynamoDB integration tests

Use a real-compatible DynamoDB test environment where possible. Cover:

- Atomic nomination plus eligibility write.
- Two concurrent nominations for the same pair produce one acceptance.
- Expired eligibility item can be replaced even before TTL deletion.
- Unexpired eligibility item rejects the transaction.
- Idempotent replay returns the original nomination.
- Reporting GSI query uses correct boundaries.

### Slack handler tests

Cover:

- Signature verification.
- Timestamp replay rejection.
- Raw body preservation.
- Slash command acknowledgement.
- Modal construction.
- Modal validation errors.
- User eligibility mapping.
- Ephemeral response formatting.

### Queue and Lambda tests

Cover:

- SQS deserialization and schema versions.
- Retryable versus non-retryable errors.
- Partial batch failures.
- DLQ behavior.
- Duplicate event processing.

### Scheduling and reporting tests

Cover:

- First reminder and report dates.
- Daylight saving transitions.
- Half-open periods.
- Duplicate schedule invocation.
- Report ties.
- Winner DM retry without public repost.
- No-nomination message.

### Terraform tests

CI must run format and validation. Add plan review, security scanning, and policy tests for encryption, public access blocking, PITR, log retention, and least-privilege intent.

## Required concurrency test

A test must launch two or more simultaneous submissions for the same workspace, nominator, and recipient. Exactly one transaction may succeed. This is a release-blocking test.

## Test data privacy

Use synthetic Slack IDs and recognition descriptions. Never copy production descriptions into fixtures, logs, or snapshots.

## Definition of done

A feature is not complete until happy path, validation, concurrency, idempotency, dependency failure, and observability behavior are covered at the appropriate layer.
