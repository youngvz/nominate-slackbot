# AWS Infrastructure

## Required resources

### Edge and compute

- API Gateway HTTP API.
- Slack ingress Lambda.
- Nomination worker Lambda.
- Weekly reminder Lambda.
- Biweekly report Lambda.

### Messaging

- Nomination SQS queue.
- Nomination dead-letter queue.
- Lambda event source mapping.

### Persistence

- DynamoDB application table in on-demand capacity mode.
- Point-in-time recovery enabled.
- TTL enabled for retention and cleanup attributes.
- Optional scheduled export to S3.

### Scheduling

- EventBridge Scheduler schedule for weekly reminders.
- EventBridge Scheduler schedule for biweekly reports.
- Schedule timezone: `America/New_York`.

### Configuration and secrets

- Secrets Manager secret for Slack signing secret.
- Secrets Manager secret for Slack bot token.
- SSM Parameter Store or Lambda environment variables for non-secret configuration.
- Recognition channel ID and maintainer IDs remain external to source control.

### Observability

- CloudWatch log groups with explicit retention.
- CloudWatch alarms.
- Metric filters or embedded metrics.
- DLQ alarm.
- Optional dashboard.

### Backup archive

- Private encrypted S3 bucket.
- Versioning enabled.
- Public access blocked.
- Lifecycle policy.
- Bucket policy limited to export and audit roles.

## IAM boundaries

Each Lambda receives its own role.

- Ingress: read Slack secrets, send to SQS, write logs.
- Worker: read Slack token, read/write required DynamoDB keys, call Slack externally, write logs.
- Reminder: read Slack token, conditionally write reminder execution record, write logs.
- Report: query nomination index, read/write report execution records, read Slack token, write logs.
- Export workflow: export DynamoDB and write only to the archive bucket.

Avoid wildcard actions and wildcard resources where service APIs allow tighter policies.

## Network model

Phase 1 does not require a VPC because Lambda communicates with managed public AWS endpoints and Slack. Avoid adding NAT gateways, private subnets, and related baseline cost unless a future requirement introduces private resources.

## Runtime and packaging

- Use the supported Node.js Lambda runtime selected in repository configuration.
- Bundle each deployable function independently.
- Share code through workspace packages, not Lambda layers by default.
- Prefer ARM64 after compatibility and performance testing.

## Cost posture

The architecture is intentionally scale-to-zero or request-priced:

- Lambda instead of continuously running containers.
- DynamoDB on-demand instead of provisioned database capacity.
- HTTP API instead of REST API.
- SQS and EventBridge Scheduler for inexpensive managed coordination.
- No NAT gateway in Phase 1.

Add AWS Budgets and cost allocation tags before production deployment.
