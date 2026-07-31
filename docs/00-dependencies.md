# Dependencies and Environment Setup

Everything you need installed and configured before writing or running code in
this repo. Follow the sections in order — later ones assume earlier ones are
done.

If a tool isn't listed here, it isn't required. If you find you needed
something not listed, add it and the reasoning.

## Language runtime

### Node.js

- **Version:** pinned in [`.nvmrc`](../.nvmrc) (currently `20`).
- **Install:** use [`nvm`](https://github.com/nvm-sh/nvm). Then in the repo:

  ```bash
  nvm install
  nvm use
  ```

  `nvm use` reads `.nvmrc` and switches automatically. Node ≥ 20 is required
  by `package.json` `engines`.

### pnpm

- **Version:** pinned in [`package.json`](../package.json) `packageManager`
  (currently `9.12.0`).
- **Install (recommended):** Corepack. It ships with Node ≥ 16 and honors the
  `packageManager` pin:

  ```bash
  corepack enable
  corepack prepare pnpm@9.12.0 --activate
  ```

  Verify with `pnpm --version` — expect `9.12.0` exactly.
- **Alternative:** `npm i -g pnpm` and manually keep the version in sync.

After Node and pnpm are ready:

```bash
pnpm install
```

## Slack development

### Slack CLI

- **Version:** `v2.9.0+` required for org-level login (needed by Developer
  Program sandboxes, which are Enterprise Grid).
- **Install:**

  ```bash
  curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash
  ```

  Ensure `~/.local/bin` is on your `PATH`. Verify with `slack version`.
- **Auth token to create the app:** `slack login`. Paste the
  `/slackauthticket <ticket>` command into a channel or DM inside your
  target workspace/org. `slack auth list` should report
  `Authorization Level: Organization` when logged into a sandbox org.

Full setup procedure and troubleshooting: [`docs/18-slack-app-setup.md`](18-slack-app-setup.md).

### Slack workspace or Developer Program sandbox

You need somewhere to install the app. Two options:

- **Slack Developer Program sandbox (recommended).** A real Enterprise Grid
  org with up to 5 workspaces, 8 users, 2 guests, 3 Slack Connect teams,
  free with the program. Enroll at
  <https://api.slack.com/developer-program> → **Join the Program**.
- **Free personal Slack workspace.** Faster to spin up if you don't want to
  enroll in the Developer Program. Limits later integration coverage (no
  guests, no Slack Connect). Create at <https://slack.com/get-started#/createnew>.

See [`docs/18-slack-app-setup.md §About Developer Program sandboxes`](18-slack-app-setup.md).

### HTTPS tunnel for local Slack testing

Slack must be able to reach your local server over HTTPS. Any of these
works — pick one:

- **ngrok** (most common):

  ```bash
  brew install ngrok
  ngrok config add-authtoken <token>   # one-time; token from https://dashboard.ngrok.com/get-started/your-authtoken
  ```

  Free account required. HTTPS URL rotates each restart on the free plan.
- **cloudflared:**

  ```bash
  brew install cloudflared
  ```

  No account needed for `cloudflared tunnel --url http://localhost:3000`.
  URL rotates each restart.
- **Alternatives:** Tailscale funnel, localtunnel, Cloudflare Tunnel with a
  named tunnel — any tool that terminates HTTPS on a public URL and
  proxies to `http://localhost:3000` works.

## Infrastructure

### Terraform

- **Version:** ≥ 1.10 (matches `versions.tf` `required_version` in
  [`infra/modules/`](../infra/modules/)).
- **Install:** `brew install terraform` or download from
  <https://developer.hashicorp.com/terraform/install>.
- **Not required** if you're only touching `apps/` or `packages/`. Required
  for changes under `infra/`.

### AWS CLI

- **Install:** `brew install awscli` or see
  <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>.
- **Configure:** `aws configure --profile nominate-dev` (or your naming
  convention). Required when actually calling AWS — the local dev shim
  publishes to `stdout://` by default and does not touch AWS, but the
  `pnpm dev:*` helper scripts under [`scripts/dev/`](../scripts/dev/README.md)
  hit real AWS resources and need credentials with (at minimum)
  `lambda:GetFunctionConfiguration`, `lambda:InvokeFunction`,
  `sqs:SendMessage`, `secretsmanager:GetSecretValue`, and DynamoDB
  read/delete on the dev table. `pnpm dev:tail` additionally shells out
  to `aws logs tail --follow`.

### Docker

- **Install:** Docker Desktop, OrbStack, or Rancher Desktop — anything that
  provides a working `docker` command.
- **Not required for the current slice.** Will be needed when the
  persistence layer lands and we run DynamoDB Local for integration tests
  (see [`docs/13-local-development.md §Local DynamoDB`](13-local-development.md)).

## Recommended developer tools

Not required, but the repo assumes they work:

- **Git.** Any recent version. Husky hooks live in
  [`.husky/`](../.husky/) — pre-commit and pre-push run lint, typecheck,
  and tests (see [`README.md`](../README.md)).
- **VS Code or a JetBrains IDE** with a TypeScript-aware editor. The
  workspace uses TypeScript project references; a decent LSP saves time.
- **jq** (`brew install jq`) — used in a few ad-hoc troubleshooting
  commands in docs and scripts.

## Environment variables

Copy `.env.example` to `.env` in the repo root and fill it in. The config
loader requires every key to be present. See
[`docs/18-slack-app-setup.md §4a`](18-slack-app-setup.md) for what each field
should contain during local dev, including which fields are required-but-
currently-unused (placeholders are fine until later slices).

**Never commit `.env`.** `.gitignore` excludes it; `.env.example` is the
template that gets checked in.

## Verifying the setup

```bash
node -v        # >= 20
pnpm -v        # 9.12.0
slack version  # >= 2.9.0
pnpm install   # succeeds
pnpm verify    # lint + typecheck + test + build all pass
```

Everything green? You're ready to work through
[`docs/18-slack-app-setup.md`](18-slack-app-setup.md) to install the Slack
app into your workspace.
