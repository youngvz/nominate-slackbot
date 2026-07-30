# Architecture Diagrams

Visual reference index. Diagrams live inline in the docs that describe the surrounding prose — this page is a directory, not a render target. Do not add new content here; add it where the diagram is embedded.

Every mermaid fence renders natively on GitHub, VS Code, and most markdown viewers, so no build step is required.

## Diagrams

- **System topology** — [`04-system-architecture.md`](./04-system-architecture.md#selected-architecture)
  All four Lambdas, SQS + DLQ, DynamoDB, EventBridge, Secrets Manager, and the planned S3 archive. Dashed pieces are stubs.
  Companion AWS-icon version: [`diagrams/topology-aws.drawio`](./diagrams/topology-aws.drawio) — open in draw.io desktop or at [app.diagrams.net](https://app.diagrams.net/).

- **`/nominate` submission sequence** — [`03-slack-app-design.md`](./03-slack-app-design.md#submission-sequence)
  End-to-end golden path from slash command through SQS handoff, transact-write, and feedback DM. Failure branches (invalid description, repeat-window rejection) are folded in as `alt` blocks.

- **Report execution state machine** — [`10-scheduling-and-reporting.md`](./10-scheduling-and-reporting.md#idempotency-state)
  Lifecycle of a biweekly report: `PENDING` → `PUBLISHED` → (`PARTIAL_DM_FAILURE`) → `COMPLETED` / `FAILED`. Anchored to `apps/report-job/src/runReport.ts`.

- **DynamoDB single-table entity view** — [`05-dynamodb-data-model.md`](./05-dynamodb-data-model.md#overview)
  ER-style overview of the six entity types plus GSI1 projection. Dashed entities have stub repositories today (`ReminderRepository`, `AuditRepository`).

## Conventions

- Dashed borders in mermaid flowcharts denote **planned / not-yet-implemented** components.
- Where a diagram references code, adjacent prose cites the concrete `file.ts:line` so readers can jump to source.
- Schedules are labelled with `America/New_York` throughout, matching the program timezone.
- No custom colors — the renderer defaults work in both GitHub light and dark themes.
