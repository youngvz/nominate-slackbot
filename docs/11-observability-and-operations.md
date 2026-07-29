# Observability and Operations

## Structured logging

Every invocation should log structured JSON with:

- Service name.
- Environment.
- Correlation ID.
- Workspace ID.
- Event type.
- Outcome.
- Duration.
- Dependency status.
- Error category when applicable.

Never log full nomination descriptions or secrets.

## Metrics

Recommended custom metrics:

- Nomination submissions received.
- Nominations accepted.
- Self-nomination rejections.
- Ineligible-recipient rejections by reason.
- Repeat-window rejections.
- DynamoDB transaction conflicts.
- Slack API failures and rate limits.
- SQS queue age and backlog.
- DLQ message count.
- Reminder publish success/failure.
- Report publish success/failure.
- Winner DM success/failure.
- Invocation duration and error rate per Lambda.

## Alarms

At minimum:

- DLQ contains messages.
- Oldest SQS message exceeds threshold.
- Lambda error rate exceeds threshold.
- Lambda throttles occur.
- Report execution misses its expected completion window.
- Reminder execution fails repeatedly.
- DynamoDB throttling occurs.
- Secrets or configuration cannot be loaded.

## Dashboards

A small CloudWatch dashboard should show submission health, queue health, scheduled-job status, Slack dependency failures, and DynamoDB usage.

## Runbooks

### Nomination queue backlog

1. Inspect Lambda errors and throttles.
2. Verify DynamoDB and Slack dependency health.
3. Confirm visibility timeout and reserved concurrency.
4. Redrive DLQ messages only after correcting the cause.

### Report not published

1. Find the report execution record.
2. Verify period boundaries and query results.
3. Inspect Slack API response and channel membership.
4. Reinvoke using the same execution key.
5. Confirm no duplicate public message was created.

### Winner DM failure

1. Confirm the public report is published.
2. Inspect per-winner delivery status.
3. Retry only failed recipients.
4. Record permanent Slack delivery failures for maintainer review.

### Compromised Slack credential

1. Rotate or revoke the credential in Slack.
2. Update Secrets Manager.
3. Redeploy or refresh functions.
4. Review CloudTrail, application logs, and Slack administration records.

## Operational ownership

Document the owning team, on-call or escalation channel, AWS account, Slack app owner, and recovery contacts outside the public repository or in non-sensitive deployment documentation.
