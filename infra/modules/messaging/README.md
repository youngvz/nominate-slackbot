# messaging module

Nomination SQS queue and DLQ. Server-side encryption uses the SQS-managed key. A redrive policy sends poison messages to the DLQ after `max_receive_count` deliveries.

Reference: `docs/06-event-contracts.md` §SQS behavior; `docs/07-aws-infrastructure.md` §Messaging. Alarms live in the `observability` module (`docs/11` §Alarms).

The event source mapping from this queue to the nomination worker Lambda lives in the `compute` module to avoid a module dependency cycle.

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `project` | string | — | Project prefix. |
| `environment` | string | — | Environment name. |
| `visibility_timeout_seconds` | number | `90` | Must exceed the Lambda timeout plus retry buffer. |
| `max_receive_count` | number | `5` | Deliveries before a message moves to the DLQ. |
| `message_retention_seconds` | number | `345600` | Main queue retention. |
| `tags` | map(string) | `{}` | Tags. |

## Outputs

| Name | Description |
| --- | --- |
| `queue_url` | Nomination queue URL. |
| `queue_arn` | Nomination queue ARN. |
| `dlq_url` | DLQ URL. |
| `dlq_arn` | DLQ ARN. |
