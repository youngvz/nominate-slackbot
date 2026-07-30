# Deployment and Environments

## Environments

Maintain separate `dev`, `staging`, and `production` AWS configurations.

Each environment has:

- Separate AWS resources and Terraform state.
- Separate Slack app credentials where possible.
- Separate channel and maintainer configuration.
- Separate alarms and log groups.

Production uses the July 31, 2026 program anchor. Development and staging may use configurable test schedules.

## CI checks

Every pull request should run:

- Dependency installation from lockfile.
- Linting.
- Type checking.
- Unit tests.
- Integration tests where practical.
- Build/package verification.
- Terraform format and validation.
- Secret scanning.
- Infrastructure security scanning.

## Deployment order

1. Validate and plan infrastructure.
2. Deploy backward-compatible table/index changes.
3. Build versioned Lambda artifacts.
4. Apply infrastructure using reviewed artifacts.
5. Run smoke tests against Slack development or staging app.
6. Promote to production with approval.
7. Verify command, reminder/report configuration, logs, alarms, and queue health.

## Database changes

DynamoDB schema changes should be additive whenever possible. Introduce new attributes and indexes before code depends on them. Wait for new indexes to become active before deploying readers.

## Rollback

- Retain previous Lambda artifacts.
- Roll back code independently when infrastructure remains compatible.
- Do not destroy DynamoDB tables or S3 archives during routine rollback.
- For a broken schedule, disable the schedule without deleting execution history.
- Preserve idempotency records across rollback.

## Teardown

The `dev` environment is designed to be torn down freely. Run `bash scripts/infra-destroy.sh dev` (or `pnpm infra:destroy dev`); the script prints a `terraform plan -destroy` and pauses for interactive confirmation before applying. Production requires the explicit `--yes-really-production` flag as a guard rail — for example `bash scripts/infra-destroy.sh production --yes-really-production`. The S3 bucket that holds Terraform state is bootstrapped out-of-band and is not managed by this repo, so it survives a `destroy`; the state files inside it also persist, which means a subsequent re-provision reuses the same state.

## Production readiness checklist

- Slack request URLs point to production API Gateway.
- Slack signing secret and bot token are populated in Secrets Manager.
- Bot is invited to the configured recognition channel.
- Recognition channel and maintainer IDs are correct.
- DynamoDB PITR is enabled.
- S3 public access is blocked.
- SQS DLQ and alarms are active.
- Reminder and report timezone is `America/New_York`.
- First production schedules align with August 7 and August 14, 2026.
- Logs redact protected content.
- Operator runbooks and ownership are recorded.
