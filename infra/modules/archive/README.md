# archive module

Private encrypted S3 bucket for DynamoDB exports and audit data.

Reference: `docs/07-aws-infrastructure.md` §Backup archive; `docs/09-security-privacy-audit.md` §S3 controls; `docs/09` §Data retention (three-year recommendation).

Enforces versioning, four-way public access block, TLS-only access, KMS or AES256 at rest, and lifecycle expiration. When `authorized_role_arns` is non-empty the bucket policy denies every other principal.

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `project` | string | — | Project prefix. |
| `environment` | string | — | Environment name. |
| `bucket_name` | string | — | Bucket name (globally unique). |
| `kms_key_arn` | string | `""` | Optional KMS key; empty string falls back to `AES256`. |
| `lifecycle_expiration_days` | number | `1095` | Object expiration in days. |
| `authorized_role_arns` | list(string) | `[]` | Roles allowed to touch the bucket. |
| `force_destroy` | bool | `false` | Permit `terraform destroy` on a non-empty bucket. Dev only. |
| `tags` | map(string) | `{}` | Tags. |

## Outputs

| Name | Description |
| --- | --- |
| `bucket_name` | Bucket name. |
| `bucket_arn` | Bucket ARN. |
