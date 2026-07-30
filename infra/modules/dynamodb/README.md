# dynamodb module

Single application table plus reporting GSI. Reference: `docs/05-dynamodb-data-model.md` and `docs/07-aws-infrastructure.md` §Persistence.

Note: TTL is cleanup only. Application-level correctness compares `nextEligibleAtEpoch` against the current time (see `docs/02-business-rules.md` §Concurrency rule).

Scheduled export to S3 (`enable_scheduled_export`) is deferred — the module accepts the variables so the composition can stay stable, but no export resources are created yet.

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `project` | string | — | Project prefix. |
| `environment` | string | — | Environment name. |
| `table_name` | string | — | Fully qualified table name. |
| `gsi1_name` | string | `GSI1` | Name of the reporting GSI. |
| `ttl_attribute` | string | `ttl` | Attribute driving TTL cleanup. |
| `enable_pitr` | bool | `true` | Enable point-in-time recovery. |
| `enable_deletion_protection` | bool | `false` | Block `terraform destroy` of the table. |
| `enable_scheduled_export` | bool | `false` | Reserved; export resources are not yet implemented. |
| `archive_bucket_arn` | string | `""` | Reserved; will be consumed when scheduled export lands. |
| `tags` | map(string) | `{}` | Tags. |

## Outputs

| Name | Description |
| --- | --- |
| `table_name` | DynamoDB table name. |
| `table_arn` | DynamoDB table ARN. |
| `gsi1_arn` | ARN of the reporting GSI. |
