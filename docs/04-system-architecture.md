# System Architecture

## Selected architecture

```mermaid
flowchart TD
    User([Employee]) -->|/nominate| APIGW[API Gateway HTTP API]

    subgraph AWS[" "]
        APIGW --> Ingress[slack-ingress Lambda]
        Ingress -->|SendMessage| Queue[SQS nomination queue]
        Queue --> Worker[nomination-worker Lambda]
        Queue -. maxReceiveCount .-> DLQ[SQS DLQ]

        Scheduler[EventBridge Scheduler]
        Scheduler -->|Fri 09:00 ET| Reminder[reminder-job Lambda]
        Scheduler -->|biweekly Fri 12:00 ET| Report[report-job Lambda]

        Worker -->|TransactWriteItems| DDB[("DynamoDB<br/>single table + GSI1")]
        Report -->|Query GSI1| DDB
        DDB -. planned export .-> S3[("S3 archive bucket")]

        Secrets[Secrets Manager]
        Secrets -. signing secret + bot token .-> Ingress
        Secrets -.-> Worker
        Secrets -.-> Reminder
        Secrets -.-> Report

        Ingress --> Logs[CloudWatch Logs + Alarms]
        Worker --> Logs
        Reminder --> Logs
        Report --> Logs
        DLQ --> Logs
    end

    Ingress -->|views.open| SlackAPI[Slack Web API]
    Worker -->|feedback DM| SlackAPI
    Reminder -->|chat.postMessage| SlackAPI
    Report -->|chat.postMessage + winner DMs| SlackAPI

    classDef planned stroke-dasharray: 5 5,stroke-width:1px
    class Reminder,S3 planned
```

*Legend: dashed borders mark planned pieces not yet implemented (`reminder-job` handler is a stub; S3 archive export path is scaffolding). Dotted arrows denote secret material fetched at cold start and the future DDB export.*

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
