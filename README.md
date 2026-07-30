# nominate-slackbot

Internal Slack employee-recognition bot. Employees invoke `/nominate`, pick a coworker, and submit a recognition; weekly reminders and biweekly reports are published automatically.

Authoritative behavior lives under [`docs/`](docs/) — start with [`CLAUDE.md`](CLAUDE.md) for context routing.

## Getting started

Install every prerequisite tool (Node, pnpm, Slack CLI, tunnel, and the
optional AWS/Docker/Terraform bits) by working through
[`docs/00-dependencies.md`](docs/00-dependencies.md). That doc is the single
source of truth for what needs to be on your machine before writing or
running code.

Once dependencies are in place, install the Slack app into your workspace
per [`docs/18-slack-app-setup.md`](docs/18-slack-app-setup.md), then come
back here for everyday commands.

### Install

```bash
pnpm install
```

The `prepare` script wires up Husky hooks automatically.

### Everyday commands

| Command | What it does |
|---|---|
| `pnpm verify` | Runs `lint`, `typecheck`, `test`, `build` in sequence — same four checks as CI. Run this before handing off any change. |
| `pnpm lint` | ESLint across all workspaces. |
| `pnpm typecheck` | `tsc -b` across the workspace graph. |
| `pnpm test` | Unit tests (vitest, `unit` project). |
| `pnpm test:integration` | Integration tests (vitest, `integration` project). |
| `pnpm build` | Compiles every workspace via `tsc -b`. |
| `pnpm dev` | Streams `dev` scripts across workspaces. |
| `pnpm format` / `pnpm format:check` | Prettier write / check. |
| `pnpm infra:validate` | `terraform fmt -check` + `terraform validate` across `infra/modules` and `infra/environments`. |

### Git hooks

Husky enforces the same checks in source control (bypass with `--no-verify` only when you have a specific reason):

- **pre-commit** — blocks direct commits to `main`, warns on non-standard branch prefixes, then runs `pnpm lint && pnpm typecheck`.
- **pre-push** — blocks direct pushes to `main`, then runs `pnpm verify`.

### Developer workflow

Branch off `dev`, open PRs against `dev`, never commit to `main`. Full conventions (branch prefixes, commit and PR guidance, merge flow) live in [`docs/17-developer-workflow.md`](docs/17-developer-workflow.md).

## Repo layout

```text
apps/         # Lambda entry points: slack-ingress, nomination-worker, reminder-job, report-job
packages/     # domain, slack, persistence, contracts, configuration, observability
infra/        # Terraform modules and per-environment stacks
docs/         # Product, architecture, and operations documentation
```

## CI

`.github/workflows/ci.yml` runs `lint`, `typecheck`, `test`, `build` in a matrix, plus `terraform fmt`/`validate`, gitleaks, and tfsec. `.github/workflows/deploy.yml` handles environment-scoped plan/apply (manual dispatch).
