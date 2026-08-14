# Business Rules

This file is the authoritative source for nomination and reporting semantics.

## Definitions

- **Workspace:** the Slack workspace where the application is installed.
- **Nominator:** the employee submitting recognition.
- **Recipient:** the employee being recognized.
- **Valid nomination:** a successfully stored nomination that passed all Phase 1 validation rules.
- **Eligibility window:** the rolling 14 × 24-hour restriction for a nominator-recipient pair.
- **Reporting period:** a fixed, half-open two-week interval used to aggregate results.

## Recipient eligibility

A recipient is eligible only when all conditions are true:

1. Recipient and nominator belong to the same installed workspace.
2. Recipient is not the nominator.
3. Recipient is active.
4. Recipient is a human account, not a bot or app.
5. Recipient is not a guest.
6. Recipient is not an external or Slack Connect user.

Slack user IDs are authoritative. Never compare display names or handles to enforce these rules.

## Rolling repeat-nomination rule

A nomination must be rejected when the same nominator has an unexpired eligibility record for the same recipient in the same workspace.

The window begins at the accepted nomination timestamp and lasts exactly 14 × 24 hours.

Example:

- Accepted: August 1, 2026 at 10:30 AM EDT.
- Next eligible: August 15, 2026 at 10:30 AM EDT.

This is independent from the fixed reporting schedule.

## Concurrency rule

The nomination record and pair eligibility record must be created or replaced in one DynamoDB transaction. A read-then-write flow is not sufficient.

An expired eligibility item may still physically exist because DynamoDB TTL deletion is asynchronous. Correctness must use `nextEligibleAt`, not item absence alone.

## Description rules

- Required.
- Plain text.
- Trim leading and trailing whitespace.
- Minimum 10 characters after trimming.
- Maximum 1,000 characters.
- Reject empty or whitespace-only values.
- Do not perform automated profanity filtering in Phase 1.

## Scoring

- Each valid nomination contributes one point to its recipient.
- Descriptions do not change score.
- Nominator title, department, or seniority does not change score.
- Repeated nominators do not receive extra weighting.
- Counts are informational — used privately to gauge how many teammates recognized a person — and do not filter who is named publicly or who receives a DM (see §Publication rules and `docs/adr/ADR-007`).

## Reporting periods

Program timezone: `America/New_York`.

Program start: July 31, 2026 at 12:00 AM local time.

First reporting period:

```text
[2026-07-31 00:00 America/New_York, 2026-08-14 12:00 America/New_York)
```

The first report executes August 14, 2026 at 12:00 PM local time. Subsequent periods are consecutive two-week half-open intervals ending at the next report execution.

A nomination submitted exactly at a period end belongs to the next period.

## Publication rules

Public recognition channel:

- Publish the name (Slack mention) of every recipient who received at least one valid nomination in the period.
- Do not publish nominator identities.
- Do not publish descriptions in the shared channel.
- Do not publish per-recipient nomination counts.
- Do not single out top-count recipients — the message is a shoutout to everyone recognized, not a ranking (see `docs/adr/ADR-007`).
- Publish a no-nominations message when the period is empty.
- Append the standard peer-recognition disclaimer footer (see `docs/03-slack-app-design.md` §Suggested copy).

Private recipient DM:

- Send a DM to every recipient with at least one valid nomination in the period.
- Include only the descriptions associated with that recipient and period.
- Do not include nominator IDs, names, or handles.
- Preserve audit linkage internally.
- Failure to send a DM must not roll back a successfully published report.

## Maintainer authorization

A user is a maintainer when either:

- Their Slack ID is in the configured maintainer allowlist, or
- Slack identifies them as a workspace admin or owner and the implementation has permission to verify that status.

The explicit allowlist is authoritative when organizational Slack roles are broader than intended application access.

## Invalidation

Nomination invalidation is not supported in Phase 1. See `15-future-state-backlog.md` for the approved future behavior, including immediate restoration of eligibility.
