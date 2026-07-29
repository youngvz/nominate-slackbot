# System Architecture

## Selected architecture

```mermaid
flowchart TD
    User[Slack user] --> Command[/nominate]
    Command --> APIGW[API Gateway HTTP API]
    APIGW --> Ingress[Slack ingress Lambda]
    Ingress --> SlackAPI[Slack Web API]
    Ingress --> Queue[SQS nomination queue]
    Queue --> Worker[Nomination worker Lambda]
    Worker --> DDB[(DynamoDB)]
    Worker --> SlackAPI

    Scheduler[EventBridge Scheduler] --> Reminder[Reminder Lambda]
    Scheduler --> Report[Report Lambda]
    Reminder --> SlackAPI
    Report --> DDB
    Report --> SlackAPI

    Queue --> DLQ[SQS dead-letter queue]
    Ingress --> Obs[CloudWatch]
    Worker --> Obs
    Reminder --> Obs
    Report --> Obs
    DDB --> Backup[S3 export / backup]
```

## Service responsibilities

### Slack ingress Lambda

- Receive API Gateway requests.
- Preserve the raw request body for signature verification.
- Verify Slack signature and request timestamp.
- Reject replayed or forged requests.
- Route slash commands and interactive payloads.
- Open the nomination modal within Slack's trigger deadline.
- Enqueue accepted modal submissions for durable processing.
- Avoid DynamoDB or slow Slack calls on the critical acknowledgement path where practical.

### Nomination worker Lambda

- Deserialize and validate the internal event.
- Resolve recipient metadata when necessary.
- Apply domain eligibility rules.
- Execute the atomic DynamoDB nomination transaction.
- Send private success or error feedback.
- Emit metrics and structured audit metadata.

### Reminder Lambda

- Post one weekly reminder to the configured shared channel.
- Use a deterministic execution key to prevent duplicate posts.

### Report Lambda

- Determine the fixed reporting period.
- Query valid nominations for that period.
- Aggregate counts by recipient.
- Publish all top-scoring tied recipients.
- Store a report execution record before or during publication.
- Send each winner their descriptions privately.
- Retry failed winner DMs independently from public report publication.

## Reliability principles

- Slack requests, SQS events, and schedules can be delivered more than once.
- Every write and side effect must have an idempotency key.
- Public report publication must be exactly-once from the user's perspective, even though infrastructure delivery is at-least-once.
- Failed asynchronous messages flow to a DLQ after configured retries.
- Partial failures must not corrupt nomination eligibility or report state.

## Trust boundaries

- Slack-to-AWS traffic is untrusted until signature verification succeeds.
- Lambda execution roles receive only the permissions needed by that function.
- Slack tokens and signing secrets come from Secrets Manager.
- Public repository configuration contains placeholders only.

## Monorepo boundaries

Recommended deployable applications:

```text
apps/slack-ingress
apps/nomination-worker
apps/reminder-job
apps/report-job
```

Recommended shared packages:

```text
packages/domain
packages/contracts
packages/slack
packages/persistence
packages/configuration
packages/observability
```

Shared packages must not import deployable applications.
