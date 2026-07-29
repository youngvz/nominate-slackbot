# Product Requirements

## Product goal

Create an internal Slack workflow that makes employee recognition easy within existing communication habits. Employees should be able to nominate coworkers without leaving Slack, while the organization receives consistent reminders and biweekly recognition results.

## Phase 1 personas

- **Employee:** submits nominations and receives private success or validation feedback.
- **Recipient:** may receive nominations and privately receives recognition descriptions when they win a reporting period.
- **Workspace maintainer:** an approved Slack user ID, workspace admin, or workspace owner responsible for operational oversight and audit access.
- **Operator:** maintains the AWS deployment, secrets, schedules, logs, and recovery procedures.

## Primary workflow

1. An employee invokes `/nominate` from a channel or DM.
2. The bot opens a Slack modal.
3. The employee selects a recipient using Slack's user selector.
4. The employee enters a required recognition description.
5. The bot validates recipient eligibility and the rolling 14-day rule.
6. The bot stores the nomination atomically.
7. The nominator receives an ephemeral success message.
8. Each Friday at 9:00 AM, the bot posts a reminder in the configured recognition channel.
9. Every other Friday at 12:00 PM, the bot publishes the winner or tied winners in that channel.
10. Each winner receives a private DM containing their valid nomination descriptions, without nominator identities.

## Functional requirements

### Nomination submission

- `/nominate` is the primary entry point.
- The command opens a modal rather than parsing free-form command arguments.
- Recipient selection uses a Slack `users_select` element.
- The recognition description is required, plain text, trimmed, and 10 to 1,000 characters.
- Confirmation and errors are private to the nominator.

### Eligibility

A recipient must:

- Belong to the installed workspace.
- Be an active human Slack account.
- Not be the nominator.
- Not be a guest.
- Not be a Slack Connect or external user.
- Not be a bot or app account.

### Repeat nominations

- A nominator may nominate multiple different recipients.
- Multiple people may nominate the same recipient.
- The same nominator may nominate the same recipient only once per rolling 14 × 24 hours.

### Reminders and reports

- One shared Slack channel is used for reminders and reports.
- The channel is deployment configuration, not committed source code.
- Reminders occur weekly.
- Reports occur every two weeks.
- Winners are determined strictly by valid nomination count.
- One nomination equals one point.
- All tied highest-scoring recipients are published.
- A no-activity message is published when a reporting period has no nominations.

### Winner messages

- The public report does not identify nominators.
- Each winner privately receives the descriptions written for that winner during the reporting period.
- Winner messages should warn that wording may indirectly reveal the author even though the system does not display their identity.

## Non-functional requirements

- Slack interactions must be acknowledged within Slack's deadline.
- Submission processing must be concurrency-safe and idempotent.
- Scheduled jobs must not duplicate public reports or winner DMs.
- The system must support retries and dead-letter handling.
- Logs must be structured and must not expose nomination text or secrets.
- Operational data is retained for one year.
- Backups and audit archives may be stored in encrypted S3 with lifecycle controls.
- The repository is intended to be open source; all company-specific values must remain external configuration.

## Out of scope for Phase 1

- Nomination invalidation.
- Immediate eligibility restoration after invalidation.
- Automated profanity or inappropriate-language blocklists.
- Public Slack Marketplace distribution.
- Multi-customer administration.
- A custom web administration portal.
- Message shortcuts.
- Weighted voting or department-based scoring.
