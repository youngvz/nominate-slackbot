# secrets module

Secrets Manager entries for the Slack signing secret and bot token.

The module provisions containers and IAM only. Secret values are populated out of band per `docs/09-security-privacy-audit.md` §Secrets.

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `project` | string | — | Project prefix. |
| `environment` | string | — | Environment name (`dev`, `production`). |
| `kms_key_arn` | string | `""` | Optional customer KMS key ARN. Empty string uses the AWS-managed key. |
| `tags` | map(string) | `{}` | Required tags per `docs/08` §Required tags. |

## Outputs

| Name | Description |
| --- | --- |
| `signing_secret_arn` | ARN of the Slack signing secret container. |
| `bot_token_arn` | ARN of the Slack bot token container. |
