# observability module

CloudWatch alarms for every Lambda plus a DLQ depth alarm; optional shared dashboard.

Reference: `docs/11-observability-and-operations.md` (metrics + alarm list) and `docs/07-aws-infrastructure.md` §Observability.

Log groups are created in the `compute` module (co-located with the functions they belong to).

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `project` | string | — | Project prefix. |
| `environment` | string | — | Environment name. |
| `alarm_topic_arn` | string | `""` | Optional SNS topic for alarm actions. |
| `dlq_arn` | string | — | DLQ ARN (currently used for docs / future dead-letter targets). |
| `dlq_name` | string | — | DLQ name (used as the CloudWatch dimension). |
| `queue_url` | string | `""` | Optional main queue URL. |
| `queue_name` | string | `""` | Optional main queue name for dashboard widgets. |
| `lambda_function_names` | list(string) | `[]` | Functions to attach errors/duration/throttle alarms to. |
| `duration_p99_threshold_ms` | number | `5000` | p99 duration alarm threshold. |
| `dlq_depth_threshold` | number | `0` | DLQ depth alarm threshold. |
| `create_dashboard` | bool | `false` | Emit an optional shared dashboard. |
| `tags` | map(string) | `{}` | Tags. |

## Outputs

| Name | Description |
| --- | --- |
| `dashboard_arn` | Dashboard ARN when `create_dashboard = true`. |
| `alarm_arns` | ARNs of every alarm created by the module. |
