# Slack Nomination Bot: Coding Agent Guide

## Purpose

This repository implements an internal Slack employee-recognition bot. Employees invoke `/nominate`, select an eligible coworker, and provide a recognition description. The system prevents self-nominations and repeat nominations from the same nominator to the same recipient within a rolling 14-day window. It sends weekly reminders and publishes biweekly results.

## Authoritative decisions

- TypeScript on the current supported Node.js Lambda runtime selected by the project.
- Slack Bolt for JavaScript.
- Slack HTTP request URLs through API Gateway HTTP API.
- AWS Lambda for compute, SQS for asynchronous processing, and EventBridge Scheduler for recurring jobs.
- DynamoDB on-demand for operational persistence.
- Terraform for all AWS infrastructure.
- Monorepo structure.
- Single production Slack workspace in Phase 1, with workspace-aware keys and models.
- Program timezone: `America/New_York`.
- Program start: July 31, 2026.
- Weekly reminder: Fridays at 9:00 AM local time, beginning August 7, 2026.
- Biweekly report: every other Friday at 12:00 PM local time, beginning August 14, 2026.

Do not replace these choices without an approved ADR.

## Context routing

Read only the files relevant to the current task, plus any directly linked dependencies.

| Task or conversation context | Read first | Also read when relevant |
|---|---|---|
| Product scope, user journeys, acceptance criteria | `docs/01-product-requirements.md` | `docs/02-business-rules.md` |
| Eligibility, nomination limits, winners, descriptions | `docs/02-business-rules.md` | `docs/05-dynamodb-data-model.md` |
| Slack command, modal, user selection, messages, permissions | `docs/03-slack-app-design.md` | `docs/06-event-contracts.md`, `docs/09-security-privacy-audit.md` |
| Overall service boundaries or data flow | `docs/04-system-architecture.md` | `docs/06-event-contracts.md` |
| DynamoDB keys, transactions, indexes, TTL | `docs/05-dynamodb-data-model.md` | `docs/02-business-rules.md` |
| SQS payloads, service interfaces, idempotency | `docs/06-event-contracts.md` | `docs/04-system-architecture.md` |
| AWS resources and service configuration | `docs/07-aws-infrastructure.md` | `docs/08-terraform-standards.md` |
| Terraform modules, environments, state, naming | `docs/08-terraform-standards.md` | `docs/07-aws-infrastructure.md` |
| Secrets, authorization, privacy, audit records | `docs/09-security-privacy-audit.md` | `docs/03-slack-app-design.md` |
| Reminders, report windows, winner DMs, retries | `docs/10-scheduling-and-reporting.md` | `docs/02-business-rules.md` |
| Logging, metrics, alarms, support procedures | `docs/11-observability-and-operations.md` | `docs/14-deployment-and-environments.md` |
| Tests or definition of done | `docs/12-testing-strategy.md` | the scope document for the feature |
| Local setup and developer commands | `docs/13-local-development.md` | `docs/03-slack-app-design.md` |
| CI/CD, releases, rollback, environments | `docs/14-deployment-and-environments.md` | `docs/08-terraform-standards.md` |
| Deferred features or future improvements | `docs/15-future-state-backlog.md` | relevant ADR or scope file |
| Why a major architecture choice was made | `docs/adr/` | `docs/16-decision-register.md` |
| Branch naming, PR flow, merge rules | `docs/17-developer-workflow.md` | `docs/14-deployment-and-environments.md` |
| Original research and external rationale | `docs/research/deep-research-report.md` | only when current docs are insufficient |

## Phase 1 boundaries

Phase 1 includes nomination submission, eligibility enforcement, weekly reminders, biweekly reports, private winner descriptions, audit-ready attribution, and operational safeguards.

Phase 1 does not include:

- Nomination invalidation or restoration.
- A Slack-based administration interface.
- Public Slack Marketplace distribution.
- Automated language moderation or blocklists.
- Slack Connect recipients.
- Guest recipients.

Do not implement backlog features unless the task explicitly promotes them into scope.

## Engineering rules

1. Keep Slack transport models separate from domain models.
2. Store immutable Slack user IDs, not display names, as identifiers.
3. Validate at the interaction boundary and again in the domain service.
4. Enforce the rolling eligibility rule atomically with DynamoDB transactions and conditional expressions.
5. Never use DynamoDB TTL deletion as the correctness mechanism for eligibility.
6. Make all consumers idempotent. Slack, SQS, Lambda, and EventBridge may retry.
7. Use half-open time intervals: `[start, end)`.
8. Store timestamps as UTC ISO-8601 strings or epoch values; render them in `America/New_York` when user-facing.
9. Never log Slack tokens, signing secrets, or full nomination descriptions.
10. Infrastructure changes must be made through Terraform.
11. Update tests and the relevant documentation when behavior changes.
12. Record changes to major architecture or business semantics in an ADR.

## Suggested monorepo shape

```text
apps/
  slack-ingress/
  nomination-worker/
  reminder-job/
  report-job/
packages/
  domain/
  slack/
  persistence/
  contracts/
  configuration/
  observability/
infra/
  modules/
  environments/
docs/
```

## Local verification

After every code change, run `pnpm verify` before reporting the task as complete. It runs the same four checks the `node` job runs in CI (`.github/workflows/ci.yml`): `lint`, `typecheck`, `test`, `build`. If any step fails, fix it before handing back. Skip only when the user explicitly says so (e.g. "don't run tests", "skip verify"), or when the change touches nothing the checks can see (pure docs/infra edits — infra has its own `pnpm infra:validate`).

Husky enforces the same gates in source control: `.husky/pre-commit` runs `lint` + `typecheck`, `.husky/pre-push` runs the full `pnpm verify`. Never bypass with `--no-verify` unless the user explicitly asks for it.

## Source control workflow

`main` is release-only. Never commit or push directly to `main` — the Husky hooks will reject it. Cut branches from `dev` using the prefixes `feat/`, `fix/`, `chore/`, or `task/`, and open PRs against `dev`. Direct commits to `dev` are allowed as an escape hatch when the user asks for them. Full conventions live in [`docs/17-developer-workflow.md`](docs/17-developer-workflow.md).

## Definition of done

A change is complete when its implementation, automated tests, infrastructure changes, observability, configuration, and affected documentation are all updated.
