# Slack Employee Recognition Bot Research Report

## Executive Summary

Because the user’s topic was “unspecified,” I inferred the actual research target from the uploaded brief: an implementation-ready architecture for a **Slack employee recognition and nomination bot** built on **Slack + AWS + Terraform**, with strong emphasis on exact business rules, minimum necessary permissions, concurrency safety, and operational clarity. The uploaded brief explicitly asks for decisions on Slack interaction patterns, persistence tradeoffs, AWS architecture, Terraform structure, security, scheduling, observability, and a final decision record. fileciteturn3file0

The strongest overall design is: **`/nominate` remains the primary entry point, but it should open a modal rather than rely on raw slash-command parsing; production delivery should use Slack HTTP request URLs rather than Socket Mode; the request path should acknowledge Slack within 3 seconds and hand slow work to SQS-backed workers; and the primary datastore should be PostgreSQL on Amazon RDS**, because PostgreSQL can enforce the exact rolling 14-day duplicate-prevention rule with a **database-level exclusion constraint over timestamp ranges**, while also making reporting, audit history, and schema evolution much easier than DynamoDB for this workload. Slack officially requires slash commands and interactive payloads to be acknowledged quickly, modals require a valid `trigger_id` within 3 seconds, Slack recommends HTTP over Socket Mode for highest production reliability, and PostgreSQL officially supports range types and exclusion constraints for “non-overlapping” time windows. citeturn39search6turn39search0turn8search2turn16search0turn15search4

For application stack, the best primary recommendation is **TypeScript + Slack Bolt for JavaScript + AWS Lambda on `nodejs22.x`**, not `nodejs20.x`. Slack’s latest Bolt for JS release requires Node 20 or later, but AWS Lambda marks `nodejs20.x` as deprecated as of April 30, 2026 while supporting `nodejs22.x` and `nodejs24.x`, so a new implementation should skip directly to `nodejs22.x`. Terraform should use a modular repository with separate environment roots, S3 remote state with versioning and lockfiles, and secrets stored outside Terraform state whenever possible. citeturn34search0turn36search0turn36search4turn18search0turn18search1turn17search0

The most important unresolved product questions are not technical but policy-driven: whether guests and external users are eligible nominees, whether nominator identities should appear in reports, whether nomination descriptions should ever be public, and how administrative invalidation should affect future eligibility. Those choices can be implemented cleanly either way, but they change rules, permissions, and user expectations. Slack’s Enterprise and shared-channel docs make clear that identities and conversation context can span workspaces and that apps should decide explicitly which shared-channel behaviors they support. citeturn33search1turn33search2

## Assumptions and Topic Selection

The uploaded brief defines a concrete project: a Slack bot that accepts nominations via `/nominate`, prevents self-nominations and duplicate nominator→recipient submissions within a rolling **14 × 24 hour** window, sends weekly reminders, publishes a biweekly recognition report, runs on AWS, and is provisioned with Terraform. It also explicitly asks for comparisons between raw slash parsing, modals, shortcuts, DynamoDB, PostgreSQL, Aurora Serverless v2, Lambda versus long-running services, and TypeScript versus Python. fileciteturn3file0

Given that brief, the highest-priority research topics are these four:

| Topic | Definition and scope | Key recent findings | Major open questions | Practical implication |
|---|---|---|---|---|
| Slack interaction model | How users invoke nominations and receive results | Slash commands must be acknowledged quickly; raw `text` can contain arbitrary user input; Slack exposes a `response_url`; modals require a valid `trigger_id` and expire after 3 seconds; Slack guidance generally favors helpful ephemeral responses for slash commands. citeturn39search6turn40search0turn40search6turn39search0turn40search7 | Is raw parsing acceptable for v1, or should modal UX be mandatory? Should a shortcut be added in v1 or later? | Keep `/nominate`, but make it open a modal for structured recipient selection and description entry. |
| Persistence and concurrency | How to store nominations and guarantee “one pair per rolling 14 days” | PostgreSQL range types plus exclusion constraints are a natural way to enforce non-overlapping time windows; advisory locks are a fallback; DynamoDB transactions support atomic conditional writes, but TTL is asynchronous and should not be used for correctness-sensitive locks or window expiration. citeturn16search0turn15search2turn12search6turn12search0turn12search2 | Should invalidated nominations reopen eligibility? Is lowest cost more important than simplest correctness proof? | Prefer PostgreSQL for exact enforcement and reporting simplicity; keep DynamoDB as the low-ops alternative. |
| AWS compute and scheduling | How to receive Slack traffic, process it, and publish reminders/reports | Slack recommends HTTP over Socket Mode for highest production reliability; API Gateway Lambda proxy integration is the default simplified integration; SQS + Lambda should be configured with correct visibility timeout and partial-batch behavior; EventBridge Scheduler supports IANA time zones and DST-aware cron scheduling. citeturn8search2turn10search6turn10search7turn13search2turn13search6turn11search1turn11search3 | Is Lambda sufficient, or is a continuously running service justified? Should scheduling be done by Slack scheduled messages or AWS? | Use API Gateway HTTP API + Lambda + SQS + EventBridge Scheduler. |
| Stack, security, and IaC | Language choice, runtime freshness, secret handling, state layout | Bolt for JS v5 arrived in July 2026; Lambda currently supports `nodejs22.x` and `nodejs24.x` while `nodejs20.x` is deprecated; Terraform recommends modular structure, separate environment configs, and remote state locking/versioning; Slack added optional scopes in 2026, which strengthens “ask only for what you truly need.” citeturn34search0turn34search1turn36search0turn36search4turn18search0turn18search1turn17search0turn17search1turn31search4 | TypeScript vs Python team fit; how much local developer convenience to optimize for | Recommend TypeScript on `nodejs22.x`, Terraform modules + environment roots, Secrets Manager for tokens. |

### Topic references

#### Slack interaction model

1. Implementing slash commands. citeturn39search6  
2. Modals. citeturn39search0  
3. Handling user interaction and `response_url`. citeturn40search6  
4. Bolt JS commands. citeturn40search1  
5. Slack Marketplace slash-command guidance. citeturn40search7  

#### Persistence and concurrency

1. PostgreSQL range types. citeturn16search0  
2. PostgreSQL exclusion constraints. citeturn15search4  
3. PostgreSQL advisory locks. citeturn15search2  
4. DynamoDB transactional writes. citeturn12search6  
5. DynamoDB TTL behavior and limitations. citeturn12search0turn12search2  

#### AWS compute and scheduling

1. Comparing HTTP and Socket Mode. citeturn8search2  
2. API Gateway Lambda proxy integration. citeturn10search6turn10search7  
3. Lambda with SQS configuration. citeturn13search2turn13search6  
4. EventBridge Scheduler schedule types and time zones. citeturn11search1turn11search3  
5. RDS Proxy. citeturn9search1  

#### Stack, security, and IaC

1. Bolt for JS v5 release. citeturn34search0  
2. Node Slack SDK July 2026 release. citeturn34search1  
3. AWS Lambda runtimes. citeturn36search0turn36search4  
4. Terraform style guide and standard module structure. citeturn18search0turn18search1  
5. Terraform S3 backend and locking. citeturn17search0turn17search1  

## Recommended End-to-End Architecture

The recommended production flow is a **fast-ack HTTP ingestion path** with **asynchronous business processing**. That matches Slack’s 3-second acknowledgement requirement, Slack’s production preference for HTTP over Socket Mode, and AWS’s standard API Gateway → Lambda proxy model. It also keeps the database and Slack Web API work off the request-critical path. citeturn39search6turn39search0turn8search2turn10search6turn10search7

```mermaid
flowchart TD
    U[Slack user] --> C[/nominate]
    C --> S[Slack request to HTTPS endpoint]
    S --> G[API Gateway HTTP API]
    G --> A[Ingress Lambda<br/>verify signature + parse + ack]
    A -->|open modal or ack 200| U
    A --> Q[SQS queue]

    Q --> W[Worker Lambda]
    W --> D[(PostgreSQL on RDS)]
    W --> SM[Slack Web API]

    E[EventBridge Scheduler] --> R1[Reminder Lambda]
    E --> R2[Report Lambda]
    R1 --> D
    R1 --> SM
    R2 --> D
    R2 --> SM

    A --> CW[CloudWatch Logs/Metrics]
    W --> CW
    R1 --> CW
    R2 --> CW
    Q --> DLQ[Dead-letter queue]
```

The specific implementation choice is:

- **API Gateway HTTP API** rather than REST API, because AWS positions Lambda proxy integration as the simplified default model and HTTP APIs are the lower-cost, lower-latency API Gateway option for common serverless proxy workloads. citeturn10search6turn10search7turn37search0turn21search7
- **HTTP request URLs instead of Socket Mode** in production, because Slack explicitly says HTTP provides the highest reliability for production connectivity and Socket Mode is more attractive for development or environments that cannot expose HTTP. citeturn8search2turn8search0
- **SQS between ingress and worker**, because Slack requires quick acknowledgement, while SQS + Lambda provides retry behavior, DLQ support, and partial-batch failure handling guidance from AWS. citeturn39search6turn13search2turn13search6turn10search8
- **EventBridge Scheduler** for weekly reminders and biweekly reports, because it supports cron schedules in IANA time zones and documents DST behavior, which is much easier to reason about than scattering schedule ownership across Slack scheduled messages. Slack can schedule messages via `chat.scheduleMessage`, but AWS-side scheduling centralizes retries, idempotency, and configuration. citeturn31search6turn11search1turn11search3

A strong v1 split is: the slash command **acks immediately and opens a modal**, the modal submission enqueues a job, and the worker decides whether to answer via `response_url`, ephemeral message, or DM. Slack documents that `response_url` can be used up to five times within 30 minutes and that it can post replies tied to the originating interaction. citeturn39search0turn40search6turn40search1

## Data Model and Business Rules

### Primary persistence recommendation

**Amazon RDS for PostgreSQL** is the best primary datastore for this bot. The decisive reason is not raw throughput but **correctness with low implementation risk**: PostgreSQL can enforce the rolling 14-day rule in the database itself using a `tstzrange` plus an exclusion constraint, whereas DynamoDB requires a more application-specific transactional design and cannot rely on TTL for exact rule expiry because TTL deletion is asynchronous and may lag by hours or days. PostgreSQL also makes biweekly aggregation, history queries, auditability, and schema evolution materially simpler. citeturn16search0turn15search4turn12search0turn12search2turn12search6

The exact rule should be written this way:

> **Reject a nomination if there exists an accepted nomination in the same workspace with the same nominator Slack user ID and recipient Slack user ID whose submission time falls within the previous 14 × 24 hours.**

That rule should be implemented with UTC storage and interval arithmetic, then rendered in workspace-local time for admins and published reports. PostgreSQL’s `tstzrange` and overlap operator `&&` are designed exactly for this kind of time-window conflict detection. citeturn16search0

### PostgreSQL schema pattern

A practical schema core is:

- `workspaces`
- `users`
- `nominations`
- `bot_config`
- `published_reports`

The concurrency-critical table is `nominations`, with a generated duplicate window:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE nominations (
  nomination_id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  nominator_user_id text NOT NULL,
  recipient_user_id text NOT NULL,
  description text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  source_channel_id text,
  source_type text NOT NULL,
  status text NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  duplicate_window tstzrange GENERATED ALWAYS AS
    (tstzrange(submitted_at, submitted_at + interval '14 days', '[)')) STORED,
  CHECK (nominator_user_id <> recipient_user_id)
);

ALTER TABLE nominations
ADD CONSTRAINT nominations_no_pair_overlap
EXCLUDE USING gist (
  workspace_id WITH =,
  nominator_user_id WITH =,
  recipient_user_id WITH =,
  duplicate_window WITH &&
)
WHERE (status = 'accepted');
```

This is a direct application of PostgreSQL’s official guidance that exclusion constraints are often more appropriate than uniqueness constraints for non-overlapping ranges, and `btree_gist` exists specifically to combine scalar equality with range overlap logic. citeturn16search0turn15search4

### DynamoDB fallback design

DynamoDB is still a credible second choice if the team strongly prioritizes serverless operations and lowest idle cost. The right DynamoDB design is **not** “query then insert.” It should use `TransactWriteItems` with at least two items: a durable nomination record and a pair-lock/eligibility record keyed by `(workspace_id, nominator_user_id, recipient_user_id)`, updated only when the stored `next_eligible_at <= now()`. That gives atomicity. What DynamoDB should **not** do is depend on TTL deletion to determine whether the 14-day window has expired, because TTL cleanup is asynchronous and explicitly not suitable for stale-lock correctness. citeturn12search6turn12search0turn12search2

### Reporting semantics

The **eligibility window** should stay **rolling** because that is the business rule in the brief. The **reporting window** should be **fixed and calendar-aligned**, not rolling. The best v1 rule is:

- each workspace has a timezone
- its report period is a fixed **two-week interval**
- boundaries are computed in workspace-local time, then stored in UTC as `[start, end)`
- the report counts nominations whose `submitted_at >= start` and `< end`
- if multiple recipients tie for highest accepted count, **publish all tied recipients**
- if no accepted nominations exist, publish a **no nominations this period** message
- by default, **do not reveal nominator identities** and **do not include description text verbatim** in the public report

This separation keeps user eligibility fair while keeping reports auditable, rerunnable, and idempotent. It also aligns naturally with EventBridge Scheduler’s timezone-aware cron support. citeturn11search1turn11search3

## Slack Platform and Application Stack

### Interaction design recommendation

The primary UX should be:

1. user enters `/nominate`
2. app acknowledges immediately
3. app opens a modal
4. modal captures recipient and required description
5. submission is validated asynchronously
6. user gets an ephemeral success or error outcome

Slack’s own docs make this a better fit than raw parsing because slash-command `text` can contain “absolutely anything,” while a modal gives structured selection and required input controls. Modals are also officially supported from slash-command entry points using the `trigger_id` that arrives in the command payload. citeturn40search0turn39search0turn39search2

A **message shortcut** is worth adding later, not first. It is useful when recognition should begin from a specific message, but the uploaded brief says `/nominate` should remain primary. In v1, the modal path already solves the biggest reliability problems without adding another user-facing surface. fileciteturn3file0

### Response visibility and sample messages

Slack guidance for slash commands generally favors **ephemeral** responses unless a public post is intentional. That lines up with the privacy-sensitive nature of nomination descriptions. citeturn40search7turn40search6

| Scenario | Recommended response | Example |
|---|---|---|
| Successful nomination | Ephemeral to nominator | “Your nomination for <@U123> was recorded. Thanks for recognizing their work.” |
| Self-nomination | Ephemeral | “You can’t nominate yourself. Please choose another teammate.” |
| Duplicate within 14 days | Ephemeral | “You already nominated <@U123> within the last 14 days. You can nominate them again after the eligibility window expires.” |
| Missing recipient | Modal validation error if possible, otherwise ephemeral | “Choose the teammate you want to recognize.” |
| Missing description | Modal validation error | “Please add a short description explaining the recognition.” |
| Bot or deleted account | Ephemeral | “That account can’t receive nominations.” |
| Infrastructure failure | Ephemeral | “We couldn’t save your nomination right now. Please try again in a moment.” |

Those are product messages rather than platform requirements, but they are aligned with Slack’s documented recommendation to provide helpful usage and error responses for slash commands. citeturn40search7turn40search0

### Minimum OAuth scopes

A disciplined minimum scope set is:

| Scope | Why it is needed |
|---|---|
| `commands` | Required for slash commands. citeturn31search0 |
| `chat:write` | Required to send messages, ephemerals, updates, and scheduled messages through Slack APIs. citeturn31search6 |
| `users:read` | Required for `users.info` / `users.list` and stable user resolution. citeturn31search3turn31search8 |

Then add these **only if the implementation uses them**:

| Optional scope | When to add it |
|---|---|
| `channels:read` | If admins browse, validate, or inspect public channels via Conversations API. citeturn32search0turn32search4 |
| `groups:read` | If admins browse, validate, or inspect private channels via Conversations API. citeturn32search4turn32search14 |
| `im:read`, `mpim:read` | Only if the app explicitly inspects DM/MPDM conversation metadata beyond what Slack already sends in payloads. citeturn32search4turn32search12 |
| `chat:write.public` | Only if the app must post in public channels without being invited; otherwise avoid it. citeturn31search7turn31search10 |

Slack’s 2026 support for **optional scopes** is especially useful here: channel-browsing scopes can be marked optional if the core product works without them. citeturn31search4

### Enterprise and identity handling

The app should store **Slack user IDs, not display names**, and should treat IDs beginning with `U` or `W` as valid. In Enterprise contexts, Slack recommends using the Enterprise user ID when provided. Apps should also consciously decide how they behave in Slack Connect and Enterprise-shared channel contexts rather than assuming a single-workspace world. citeturn33search2turn33search1turn33search5

### Recommended stack

The primary stack recommendation is **TypeScript + Slack Bolt for JavaScript + AWS Lambda `nodejs22.x`**. Slack’s latest Bolt for JS release is current, mature, and aligned with modern Node, while AWS Lambda now supports `nodejs22.x` and has already deprecated `nodejs20.x`. Python remains a strong second choice, especially for teams that want Bolt Python’s FaaS-oriented lazy listener patterns, but TypeScript is the better default for long-term maintainability and typing at the Slack payload boundary. citeturn34search0turn34search1turn36search0turn36search4turn39search7

A clean application layout is:

```text
src/
  api/
  slack/
    commands/
    interactions/
    blocks/
    responses/
  nominations/
    domain/
    service/
    repository/
    validation/
  reports/
  reminders/
  scheduling/
  persistence/
  configuration/
  security/
  observability/
```

That structure is an architectural judgment, but it directly matches the uploaded brief’s requirement to keep Slack-specific payload handling separate from nomination business rules. fileciteturn3file0

### Example Slack app manifest

```yaml
display_information:
  name: Recognition Bot

features:
  bot_user:
    display_name: Recognition Bot
    always_online: false
  slash_commands:
    - command: /nominate
      url: https://api.example.com/slack/commands
      description: Nominate a coworker for recognition
      usage_hint: "[@person] [reason]"
      should_escape: true

oauth_config:
  scopes:
    bot:
      - commands
      - chat:write
      - users:read
    bot_optional:
      - channels:read
      - groups:read

settings:
  interactivity:
    is_enabled: true
    request_url: https://api.example.com/slack/interactivity
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: true
```

This manifest reflects the recommended minimum viable posture: slash command, interactivity, narrow bot scopes, optional channel-browsing scopes, HTTP delivery, and token rotation enabled. Slack’s manifest model and optional scopes support this structure directly. citeturn31search4turn8search2

## Infrastructure, Security, Operations, and Cost

### Terraform structure

Terraform should follow a modular structure with environment-specific roots. HashiCorp’s style guide explicitly recommends modules for logically grouped resources and separate infrastructure configuration per environment; the standard module structure also recommends keeping each module self-contained with `README.md`, `main.tf`, `variables.tf`, and `outputs.tf`. The S3 backend supports remote state with lockfiles, and HashiCorp highly recommends enabling bucket versioning. citeturn18search0turn18search1turn17search0turn17search1

```text
infrastructure/
  modules/
    api/
    compute/
    queue/
    scheduler/
    database/
    observability/
    secrets/
  environments/
    dev/
    qa/
    prod/
```

### Security and privacy posture

The minimum security baseline is:

- verify Slack signatures and reject stale timestamps
- do not trust the deprecated `token` field
- validate OAuth state
- store bot tokens in Secrets Manager, encrypted with KMS
- isolate data by `workspace_id`
- redact descriptions and tokens from logs
- keep nomination descriptions private by default
- make handlers idempotent because Slack and AWS delivery paths can retry

Slack explicitly documents signed-secret verification and deprecates the old verification token approach, while AWS Lambda guidance explicitly recommends idempotent function design because duplicate processing can occur. Secrets Manager supports scheduled rotation, and Slack supports token rotation for app credentials. citeturn0search2turn40search0turn30search6turn30search8turn13search0turn13search3turn1search3

The most important “never trust without validation” fields are: `text`, `user_id`, `channel_id`, `team_id`, and any human-readable names coming from Slack payloads. Slack itself notes that slash-command `text` can contain anything and recommends working with escaped IDs. citeturn40search0

### Observability and runbooks

Operationally, track at least these metrics:

- ingress request count and error rate
- signature verification failures
- modal-open failures
- nomination accepted / rejected / duplicate counts
- worker retry count
- Slack Web API failure count
- SQS queue depth and DLQ depth
- report publication success
- scheduler invocation success
- DB latency
- Lambda throttles and timeouts

CloudWatch alarms over custom metrics are straightforward, and Lambda/SQS metrics plus DLQ policies are standard AWS operational controls. For logs-derived metrics, CloudWatch’s embedded metric format is suitable when alarms are configured with timely log flushing assumptions. citeturn30search5turn10search8turn13search2turn13search6

A minimal runbook set should cover: Slack command failures, Slack API outages, DB outages, queue backlogs, duplicate report prevention failures, token revocation, uninstall cleanup, and Terraform deployment rollback. That recommendation comes from the uploaded brief; the exact runbook content is an implementation judgment. fileciteturn3file0

### Rough cost comparison

Under a **small internal organization** assumption—one workspace, a few hundred users, tens to low hundreds of nominations per week, very small storage footprint, and only a few scheduled posts per month—the **non-database serverless layer is cheap**. API Gateway HTTP APIs start at **$1.00 per million** requests for the first 300 million requests; Lambda request pricing is **$0.20 per million** after free tier and duration is billed per GB-second; SQS includes **1 million free requests per month**; DynamoDB on-demand standard writes are **$0.625 per million writes** and standard strongly consistent reads are **$0.125 per million reads**, with storage at **$0.25/GB-month** on the standard table class. citeturn21search7turn28search0turn19search9turn25view2

The practical cost differences are therefore driven mainly by the **database choice**:

| Architecture | Expected cost posture | Why |
|---|---|---|
| Lambda + API Gateway + SQS + DynamoDB | **Lowest**, often single-digit dollars per month at small scale | Fully pay-per-request; DynamoDB on-demand is now AWS’s recommended mode in most scenarios and its on-demand prices were reduced in late 2024. citeturn25view2turn24view0turn20search0 |
| Lambda + API Gateway + SQS + RDS PostgreSQL | **Higher**, typically “tens of dollars per month and up” because the DB runs continuously | RDS bills DB instance-hours and storage; compute dominates small workloads. Exact value depends on class/region and should be taken from the pricing calculator. citeturn26view0 |
| Lambda + API Gateway + SQS + Aurora Serverless v2 | **Variable**; can be attractive if the DB is often idle enough to benefit from 0-ACU auto-pause, but still adds Aurora storage/I/O complexity and resume behavior | Aurora Serverless v2 supports 0 ACUs on supported versions and scales in 0.5 ACU steps up to 256 ACUs, with each ACU representing roughly 2 GiB plus corresponding CPU/network. citeturn38search0turn38search6turn38search4 |

The right reading of that table is: **DynamoDB wins on cost and operations**, **RDS PostgreSQL wins on correctness simplicity and reporting ergonomics**, and **Aurora Serverless v2 is the middle-ground candidate only if “PostgreSQL semantics plus idle auto-pause” matters enough to justify its extra moving parts**. citeturn12search6turn16search0turn38search0

## Architecture Decision Record and Selected References

### Final decision record

| Decision area | Decision | Rationale | Main consequence | Revisit when |
|---|---|---|---|---|
| Slack interaction model | `/nominate` opens a modal | Raw slash text is arbitrary; modal gives structured input and required fields while preserving `/nominate` as the primary trigger. citeturn40search0turn39search0 | Slightly more implementation work, much cleaner UX and validation | If users strongly prefer ultra-fast power usage from pure text commands |
| Compute model | HTTP API Gateway + Lambda + SQS | Slack requires fast ack; Slack recommends HTTP for production; AWS proxy integration and SQS retries fit serverless well. citeturn39search6turn8search2turn10search6turn13search2 | Clear separation between ack path and worker path | If workload grows into sustained high throughput or very heavy DB usage |
| Persistence | Amazon RDS for PostgreSQL | Exact rolling-window duplicate prevention is simpler and stronger with exclusion constraints; reporting is far easier. citeturn16search0turn15search4 | Higher monthly baseline cost than DynamoDB | If cost becomes dominant and duplicate logic can be accepted in application-level Dynamo transactions |
| Duplicate-prevention design | DB-enforced exclusion constraint over `tstzrange` | Prevents race conditions under concurrency without fragile check-then-insert logic. citeturn16search0turn15search4 | PostgreSQL-specific design | If datastore changes to DynamoDB |
| Scheduling | EventBridge Scheduler | Time zones and DST are first-class, and scheduling remains under AWS operational control. citeturn11search1turn11search3 | One more AWS service, but easier governance | If Slack-native scheduling becomes a firm product requirement |
| Reporting window | Fixed biweekly `[start, end)` window in workspace-local timezone, stored in UTC | Easier auditing, reruns, and idempotent publishing than rolling reports | Requires explicit workspace timezone config | If stakeholders need rolling leaderboard behavior instead |
| Language/framework | TypeScript + Bolt JS on `nodejs22.x` | Fresh runtime choice, strong typing at Slack boundary, current Slack SDK support | JS/TS build tooling required | If team Python expertise is materially stronger |
| Terraform structure | Modules + environment roots + S3 remote state with lockfile | Matches current Terraform guidance and keeps environments separated. citeturn18search0turn18search1turn17search0 | Slightly more repo structure overhead | If the org standardizes on a different platform or registry model |

### Selected cross-cutting references

1. Uploaded project brief. fileciteturn3file0  
2. Slack slash command implementation guidance. citeturn39search6turn40search0  
3. Slack modals and `trigger_id` timing. citeturn39search0turn39search2  
4. Slack HTTP vs Socket Mode production guidance. citeturn8search2  
5. Slack scopes: `commands`, `chat:write`, `users:read`, `channels:read`, `groups:read`. citeturn31search0turn31search6turn31search3turn32search0turn32search4  
6. PostgreSQL range types and exclusion constraints. citeturn16search0turn15search4  
7. DynamoDB transactions and TTL limitations. citeturn12search6turn12search0turn12search2  
8. API Gateway Lambda proxy integration. citeturn10search6turn10search7  
9. Lambda with SQS and error handling. citeturn13search2turn13search6  
10. EventBridge Scheduler time zones and DST. citeturn11search1turn11search3  
11. Lambda runtime support and deprecations. citeturn36search0turn36search4  
12. Bolt for JS v5 and July 2026 Slack SDK releases. citeturn34search0turn34search1  
13. Terraform style guide, module structure, and S3 backend locking. citeturn18search0turn18search1turn17search0turn17search1  
14. Pricing references for API Gateway, Lambda, SQS, DynamoDB, RDS, and Aurora Serverless v2. citeturn21search7turn28search0turn19search9turn25view2turn26view0turn38search0turn38search6
