# Local Development

## Prerequisites

- Supported Node.js version defined by the repository.
- Workspace package manager defined by the repository.
- AWS CLI.
- Terraform.
- Docker when used by local infrastructure tooling.
- A dedicated Slack development app and test workspace.

## Environment variables

Provide `.env.example` with placeholders:

```env
AWS_REGION=us-east-1
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=
SLACK_RECOGNITION_CHANNEL_ID=
SLACK_MAINTAINER_IDS=
PROGRAM_TIMEZONE=America/New_York
PROGRAM_START_AT=2026-07-31T00:00:00-04:00
DYNAMODB_TABLE_NAME=
NOMINATION_QUEUE_URL=
# Ingress-only, optional. When unset, `/nominate-admin report` logs the
# invocation and returns success without actually calling the report Lambda —
# useful for local development where the report function isn't deployed.
REPORT_FUNCTION_NAME=
# Optional dev-only override for the first-report anchor. When unset, the
# domain uses the production 2026-08-14T12:00-04:00 anchor. Set alongside
# PROGRAM_START_AT to shift the first reporting period earlier so pre-launch
# test nominations fall inside a real window (docs/10 §First period).
FIRST_REPORT_AT=
# Report-job only. Target Slack workspace ID (T…) used when EventBridge
# fires the scheduled biweekly report with an empty payload
# (docs/10 §Scheduled input contract). Not read by other Lambdas.
REPORT_WORKSPACE_ID=
```

Do not commit `.env`.

## Slack development setup

The Slack app configuration is checked into `slack/manifest.json`. See
`docs/18-slack-app-setup.md` for the full setup procedure — both the Slack
CLI path and the dashboard path are documented.

Summary:

- Create a separate development Slack app from `slack/manifest.json`.
- Substitute request URLs with your local tunnel URL at install time.
- Never commit real signing secrets, bot tokens, or tunnel URLs.
- Install only the scopes declared in the manifest (`commands`, `chat:write`,
  `users:read`, `im:write`).
- Invite the bot to the development recognition channel.
- Use an HTTPS tunnel (ngrok / Cloudflared) for local callback testing.

## Local DynamoDB

Local DynamoDB may be used for fast development, but integration tests should also run against an AWS-compatible environment to catch transaction, index, and permission differences.

Seed only synthetic workspace and user IDs.

## Suggested commands

Repository scripts should expose stable commands such as:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm dev
pnpm infra:validate
pnpm infra:bootstrap                    # once per AWS account — creates the tfstate bucket
pnpm infra:artifacts <dev|production>   # per env — creates the Lambda artifact bucket
pnpm infra:stub-lambdas <dev|production>  # uploads hello-world zips so terraform apply can create the four Lambdas
pnpm infra:destroy <dev|production>     # production requires --yes-really-production
```

The actual package manager may differ, but one tool should be standardized across the monorepo. Every `infra:*` script beyond `validate` requires an AWS session; see `docs/14` §First stand-up for the run order.

## Dev helper scripts

Direct-invoke helpers under `scripts/dev/` exercise deployed dev Lambdas
without going through the Slack UI. Every script reads live env values
(queue URL, workspace ID, secret ARNs, reporting anchors) via
`GetFunctionConfiguration` on the target Lambda, so nothing drifts from
what's actually deployed. Destructive commands refuse `--env production`
and require `--yes` to mutate.

| Command | Category | What it does |
|---|---|---|
| `pnpm dev:users` | read | Lists Slack workspace users via `users.list`. |
| `pnpm dev:nominate` | write | Enqueues a `NominationSubmissionRequestedV1` on the dev SQS queue. Default recipient = first `SLACK_MAINTAINER_IDS`. |
| `pnpm dev:report` | invoke | Invokes the report Lambda with a `BiweeklyReportRequestedV1`. `--sync` returns tail logs; `forceRepublish=true` by default. |
| `pnpm dev:reminder` | invoke | Invokes the reminder Lambda directly. |
| `pnpm dev:period` | read | Preview a report over a window: counts by recipient, max, tied winners. |
| `pnpm dev:recipient` | read | Nominations to a recipient in a window with nominator IDs; descriptions truncated per `docs/09` unless `--full`. |
| `pnpm dev:clear-eligibility` | destructive | Deletes a `PAIR_ELIGIBILITY` row so a pair can re-nominate immediately. NOMINATION rows untouched. |
| `pnpm dev:reset-period` | destructive | Wipes NOMINATION + PAIR_ELIGIBILITY + REPORT_EXECUTION rows for a window. |
| `pnpm dev:tail` | read | Follows all four dev Lambdas' CloudWatch logs concurrently, color-coded per source. |

Full flag reference and usage examples live in
[`scripts/dev/README.md`](../scripts/dev/README.md).

### Testing scheduled jobs

Reminder and report handlers accept explicit scheduled timestamps and
period boundaries so on-demand runs are indistinguishable from scheduled
ones at the code path level. Use `pnpm dev:reminder` / `pnpm dev:report`
above to fire either handler with a live payload; production schedule
events remain authoritative.

## Troubleshooting

- Signature failures: confirm raw body handling and signing secret.
- Modal does not open: confirm acknowledgement timing and `trigger_id` usage.
- Bot cannot post: confirm channel membership and `chat:write`.
- Bot cannot DM: confirm required DM scope and conversation-opening flow.
- Duplicate transaction errors: inspect eligibility timestamp and transaction condition.
