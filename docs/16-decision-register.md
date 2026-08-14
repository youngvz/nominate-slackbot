# Decision Register

## Settled Phase 1 decisions

| Area | Decision |
|---|---|
| Language | TypeScript |
| Slack framework | Bolt for JavaScript |
| Runtime model | AWS Lambda |
| Slack connectivity | HTTP request URLs |
| API ingress | API Gateway HTTP API |
| Async processing | SQS plus worker Lambda |
| Persistence | DynamoDB on-demand |
| Scheduling | EventBridge Scheduler |
| Infrastructure as code | Terraform |
| Repository | Monorepo |
| Production scope | One private Slack workspace |
| Timezone | America/New_York |
| Program start | July 31, 2026 |
| Weekly reminder | Fridays at 9:00 AM, first on August 7, 2026 |
| Biweekly report | Every other Friday at 12:00 PM, first on August 14, 2026 |
| Eligibility window | Rolling 14 × 24 hours per nominator-recipient pair |
| Reporting window | Fixed half-open periods anchored to program start/report schedule |
| Guests | Cannot receive nominations |
| Slack Connect/external users | Cannot receive nominations |
| Bots and deactivated users | Cannot receive nominations |
| Self-nomination | Prohibited |
| Nomination scoring | One valid nomination equals one point; counts are informational only and do not filter publication (ADR-007) |
| Public report | Every recipient with ≥1 nomination is named; no counts, no descriptions, no winner/ranking framing (ADR-007) |
| Recipient DMs | Private DM to every recipient with ≥1 nomination, containing only their descriptions and no nominator identities (ADR-007) |
| Shared channel | One deployment-configured channel for reminders and reports |
| Maintainers | Configured Slack ID allowlist and approved workspace admins/owners |
| Operational retention | One year in DynamoDB |
| Archive | Encrypted S3 backup/export recommended |
| Invalidation | Deferred; future invalidation restores eligibility immediately |
| Content blocklist | Deferred |
| Open source | Yes; company configuration and secrets remain external |
| Terraform state and artifact buckets | Provisioned out-of-band; backend values gitignored (ADR-006) |

## Change control

A change to language, datastore, compute model, Slack transport, eligibility semantics, reporting semantics, privacy behavior, or tenant model requires an ADR.

Small implementation choices may be documented directly in the relevant scope file when they do not alter externally observable behavior or major architecture.
