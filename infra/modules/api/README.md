# api module

API Gateway HTTP API that fronts the Slack ingress Lambda. Owns the `POST /slack/events` route and the Lambda invoke permission scoped to the API's execution ARN.

Reference: `docs/07-aws-infrastructure.md` §Edge and compute; `docs/03-slack-app-design.md` §Interaction model.

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `project` | string | — | Project prefix. |
| `environment` | string | — | Environment name. |
| `ingress_lambda_invoke_arn` | string | — | Slack ingress Lambda invoke ARN. |
| `ingress_lambda_function_arn` | string | — | Slack ingress Lambda function ARN (used to scope the permission). |
| `log_retention_days` | number | `30` | Retention for the API Gateway access log group. |
| `tags` | map(string) | `{}` | Tags. |

## Outputs

| Name | Description |
| --- | --- |
| `invoke_url` | Public URL used as the Slack request URL. |
| `api_id` | HTTP API identifier. |
