# Deployment and Environments

## Environments

Maintain separate `dev` and `production` AWS configurations. Phase 1 does not include a staging environment; if one is added later, promote it through an ADR.

Each environment has:

- Separate AWS resources and Terraform state.
- Separate Slack app credentials where possible.
- Separate channel and maintainer configuration.
- Separate alarms and log groups.

Production uses the July 31, 2026 program anchor. Development may use configurable test schedules.

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

## First stand-up

Runs once per AWS account, per environment. `dev` first, then `production` with the same steps.

1. **Bootstrap the Terraform state bucket** (once per account).

   ```bash
   pnpm infra:bootstrap
   ```

   Creates `{project}-tfstate-{account-id}` with versioning, TLS-only access, and public access blocked. Idempotent.

2. **Wire the backend.** Copy `infra/environments/<env>/backend.hcl.example` to `backend.hcl` in the same directory and fill in the real bucket/key values (`{project}/<env>/terraform.tfstate`). `backend.hcl` is gitignored; only the example is tracked.

3. **Create the Lambda artifact bucket for this env.**

   ```bash
   pnpm infra:artifacts <env>
   ```

   Creates `{project}-<env>-artifacts-{account-id}`.

4. **Upload stub Lambda zips.**

   ```bash
   pnpm infra:stub-lambdas <env>
   ```

   Uploads a hello-world zip to each of the four expected S3 keys so the first `terraform apply` doesn't fail on missing objects. The real build pipeline overwrites them once application code is ready.

5. **Fill in `terraform.tfvars`.** Copy `terraform.tfvars.example` to `terraform.tfvars` (gitignored) and set the real `recognition_channel_id`, `maintainer_slack_ids`, `owner`, and `artifact_bucket` (matches step 3).

6. **Initialize and plan.**

   ```bash
   cd infra/environments/<env>
   terraform init -backend-config=backend.hcl
   terraform plan -out=<env>.tfplan
   ```

7. **Apply.**

   ```bash
   terraform apply <env>.tfplan
   ```

8. **Populate Slack secrets** (Terraform only creates the containers, per `docs/09` §Secrets).

   ```bash
   aws secretsmanager put-secret-value \
     --secret-id {project}-<env>-slack-signing-secret \
     --secret-string 'REDACTED'
   aws secretsmanager put-secret-value \
     --secret-id {project}-<env>-slack-bot-token \
     --secret-string 'xoxb-...'
   ```

9. **Configure Slack.** `terraform output slack_request_url` prints the API Gateway URL. Paste it into the Slack app's Request URL (see `docs/18`). Invite the bot to the configured recognition channel.

10. **Swap the stubs for real Lambda code.**

    ```bash
    pnpm build:lambda
    pnpm infra:upload-lambdas <env>
    ```

    `build:lambda` bundles each `apps/*/src/index.ts` into `apps/*/dist/lambda.zip` via esbuild (`@aws-sdk/*` externalized because the Lambda runtime provides SDK v3). `infra:upload-lambdas` uploads each zip to the same S3 keys the stubs occupied and calls `aws lambda update-function-code` so the running Lambdas pick up the new code — no `terraform apply` needed.

## Deployment order

Once an environment is stood up, subsequent releases follow:

1. Validate and plan infrastructure.
2. Deploy backward-compatible table/index changes.
3. Build versioned Lambda artifacts (`pnpm build:lambda`).
4. Apply infrastructure using reviewed artifacts.
5. Publish new Lambda code (`pnpm infra:upload-lambdas <env>`).
6. Run smoke tests against the Slack development app.
7. Promote to production with approval.
8. Verify command, reminder/report configuration, logs, alarms, and queue health.

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
