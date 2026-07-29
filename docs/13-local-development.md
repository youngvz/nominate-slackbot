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
```

Do not commit `.env`.

## Slack development setup

- Create a separate development Slack app.
- Configure `/nominate`.
- Configure interactivity request URLs.
- Install only required scopes.
- Invite the bot to the development recognition channel.
- Use an HTTPS tunnel for local callback testing when necessary.

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
```

The actual package manager may differ, but one tool should be standardized across the monorepo.

## Testing scheduled jobs locally

Allow reminder and report handlers to accept explicit scheduled timestamps and period boundaries in development. Production schedule events remain authoritative.

## Troubleshooting

- Signature failures: confirm raw body handling and signing secret.
- Modal does not open: confirm acknowledgement timing and `trigger_id` usage.
- Bot cannot post: confirm channel membership and `chat:write`.
- Bot cannot DM: confirm required DM scope and conversation-opening flow.
- Duplicate transaction errors: inspect eligibility timestamp and transaction condition.
