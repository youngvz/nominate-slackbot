# compute module

Provisions the four Lambdas listed in `docs/07-aws-infrastructure.md` §Edge and compute plus their per-function IAM roles per `docs/07` §IAM boundaries.

The module also creates the SQS-to-worker event source mapping and per-function CloudWatch log groups with explicit retention. The API Gateway → ingress permission lives in the `api` module (avoids a dependency cycle).

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `project` | string | — | Project prefix. |
| `environment` | string | — | Environment name. |
| `nodejs_runtime` | string | `nodejs20.x` | Node.js Lambda runtime. |
| `architecture` | string | `arm64` | Lambda architecture. |
| `artifact_bucket` | string | — | Bucket holding function zips. |
| `artifact_object_keys` | object | `{}` | Optional per-function S3 key overrides. |
| `dynamodb_table_name` | string | — | Application table name (env var). |
| `dynamodb_table_arn` | string | — | Application table ARN (IAM). |
| `dynamodb_gsi1_arn` | string | — | Reporting GSI ARN (IAM). |
| `nomination_queue_url` | string | — | Nomination queue URL (env var). |
| `nomination_queue_arn` | string | — | Nomination queue ARN (IAM + ESM). |
| `slack_signing_secret_arn` | string | — | Slack signing secret ARN. |
| `slack_bot_token_arn` | string | — | Slack bot token ARN. |
| `recognition_channel_id` | string | — | Slack recognition channel ID (env var). |
| `program_timezone` | string | `America/New_York` | Program-facing timezone. |
| `program_start_at` | string | `2026-07-31T00:00:00-04:00` | Program anchor. |
| `log_retention_days` | number | `30` | CloudWatch log retention. |
| `sqs_batch_size` | number | `5` | SQS batch size. |
| `worker_timeout_seconds` | number | `30` | Worker Lambda timeout. |
| `default_timeout_seconds` | number | `10` | Timeout for ingress/reminder/report. |
| `tags` | map(string) | `{}` | Tags. |

## Outputs

| Name | Description |
| --- | --- |
| `slack_ingress_function_name` | Slack ingress function name. |
| `slack_ingress_function_arn` | Slack ingress ARN. |
| `slack_ingress_invoke_arn` | Slack ingress invoke ARN (for API GW). |
| `nomination_worker_function_name` | Worker function name. |
| `nomination_worker_function_arn` | Worker ARN. |
| `reminder_function_arn` | Reminder ARN. |
| `reminder_function_name` | Reminder function name. |
| `report_function_arn` | Report ARN. |
| `report_function_name` | Report function name. |
