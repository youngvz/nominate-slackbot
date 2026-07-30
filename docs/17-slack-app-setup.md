# Slack App Setup

The Slack app configuration lives in `slack/manifest.json`. That file is the
source of truth for scopes, the `/nominate` slash command, and the
interactivity request URL. Whenever the Slack side needs to change (a new
scope, a new interaction endpoint), edit the manifest, commit it, and re-apply
it to the target workspace.

This doc covers two ways to apply the manifest:

- **Path A — Slack CLI** (`slack` binary). Recommended and the current dev
  setup. Repeatable, scriptable, and required for the org-level auth used
  by a Developer Program sandbox.
- **Path B — Slack dashboard.** Fallback if you can't or won't install the
  CLI. Works for any workspace/org but is manual.

Both paths install into an existing Slack workspace or Developer Program
sandbox where you have permission to install apps.

## Prerequisites

You have a Slack workspace or org where you can install apps. Two supported
options:

- **A Slack Developer Program sandbox** (recommended, and the current dev
  setup). An Enterprise Grid org provisioned free through the Developer
  Program. Sufficient for all Phase 1 work and unlocks live coverage of the
  eligibility-rejection paths later. See "About Developer Program sandboxes"
  below.
- **A free personal Slack workspace.** Faster to spin up if you're not
  enrolled in the Developer Program yet, but limits later integration
  coverage (no guests, no Slack Connect).

The repo has one Slack app per environment: `Nominate (dev)`, `Nominate
(staging)`, `Nominate (prod)`. Each is a distinct app registration in Slack
with its own signing secret and bot token. They all install from the same
`slack/manifest.json` — only the `display_information.name` and the two
request URLs change.

## About Developer Program sandboxes

A Developer Program sandbox is a real Enterprise Grid organization (up to 5
workspaces, 8 users, 2 guests, 3 Slack Connect teams), free with the
program, valid 6 months and extendable in 6-month increments. Source:
<https://docs.slack.dev/tools/developer-sandboxes/>.

Two things about it change the CLI workflow versus a free single-workspace:

1. **Login is org-level, not workspace-level.** `slack auth list` reports
   `Authorization Level: Organization` after `slack login`. Requires Slack
   CLI `v2.9.0+`.
2. **App install requires picking a workspace within the org.** The app is
   registered at the org, but its bot needs an explicit grant for each
   workspace it can operate in. The CLI prompts interactively, or you can
   pre-declare with `--org-workspace-grant <team_id>` (the workspace's `T…`
   ID, not the org `E…` ID) on `slack run` / `slack deploy`.

The manifest and application code do not change between a free workspace
and a sandbox. Guest / external / Slack Connect / bot / deactivated
rejection is unit-tested with mocked `users.info` responses; a sandbox is
the venue for live integration coverage of those paths, tracked as backlog
in `docs/15-future-state-backlog.md`.

Enrollment: <https://api.slack.com/developer-program> → **Join the Program**
→ complete registration → provision a sandbox from the dashboard.
Enterprise org members may need Org Admin approval
(<https://slack.com/help/articles/27390391126803>).

## Path A — Slack CLI (recommended)

Assumes you already have the Slack CLI installed and are enrolled in the
Developer Program with an active sandbox. If you're not, install per
<https://docs.slack.dev/tools/slack-cli/guides/installing-the-slack-cli-for-mac-and-linux/>:

```bash
curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash
slack version   # confirm on PATH; expect v2.9.0 or later for org login
```

### 1. Authorize the CLI against your sandbox org

```bash
slack login
```

The CLI prints an auth ticket. Paste it (as `/slackauthticket <ticket>`) in
any channel or DM inside a workspace of your sandbox org. Verify:

```bash
slack auth list
```

Expect `Authorization Level: Organization`. If you see `Workspace`, you
logged into a non-Grid workspace — log out and repeat inside the sandbox.

### 2. Initialize the Slack CLI hooks in this repo

The CLI needs a `.slack/` project directory pointing at our manifest. We
deliberately **skip `slack init`** and hand-write the minimal hooks —
`slack init` would try to add a hooks-package dependency to our
`package.json`, prompt to link an existing app, and generally assume the
CLI also runs the app. We only use the CLI for manifest + registration.

Create `.slack/hooks.json` at the repo root:

```json
{
  "hooks": {
    "get-manifest": "sh -c 'cat slack/manifest.json' --"
  }
}
```

The `sh -c '…' --` wrapper is required because the CLI appends its own
positional args (e.g. `--source=<repo-path>`) to the hook command — the
trailing `--` sends those to the shell rather than to `cat`.

Also add `.slack/.gitignore` containing:

```
*
```

That plus the repo-root `.gitignore` rule for `.slack/` keeps machine-local
state (`config.json` with your linked app ID) out of git.

`start` / `build` / `deploy` hooks are intentionally omitted — the Lambda
handler runs via `pnpm --filter @nominate/app-slack-ingress dev`, not
`slack run`.

### 3. Validate the manifest

```bash
slack manifest validate
```

Fix any reported errors before continuing.

### 4. Create the Slack app from the manifest

```bash
slack app install
```

Interactive prompts you'll see on a Grid / sandbox org:

- **Choose an app environment:** pick `local`. This is the CLI's slot
  label — a name for a Slack app registration inside `.slack/apps.json`.
  It has nothing to do with which Slack workspace the app runs against
  (that's the next prompt). Convention:
  - `local` — the app you point at your dev tunnel URL, expected to
    change frequently as ngrok rotates.
  - `deployed` — for staging/prod later; points at a stable API Gateway
    URL. You end up with two separate app registrations in the CLI, each
    with its own signing secret and bot token.
- **Choose a workspace:** pick one workspace inside your sandbox org.
  This is the org-workspace grant. You can add more workspaces later via
  the org admin console, or re-run `slack app install` with a different
  target.
- **Admin approval:** Admin Approval of Apps is on by default in Grid
  orgs. First install may trigger an Org Admin approval flow — approve
  it from the same Slack account if you're the org admin.

On success `slack app install` prints a table with `App ID`, `Team ID`,
`User ID`, `Status`, and `Workspace Grant`. **The CLI does not print the
signing secret or bot token** — those live in Slack's app-settings UI.
`Status: Installed` (or similar) with a filled-in `Workspace Grant`
means the bot is in the workspace and ready to fetch tokens.

Retrieve the two secrets from the browser:

1. Open `https://api.slack.com/apps/<App ID>` (paste the App ID from the
   CLI output).
2. **Basic Information** → **App Credentials** → **Signing Secret** →
   click **Show** → copy.
3. **Install App** (in the left sidebar under Settings) → **Bot User
   OAuth Token** (`xoxb-…`) → copy. This is the same token that appears
   under **OAuth & Permissions** → **OAuth Tokens**; both pages surface
   it once the app is installed to a workspace.

Put both into your local `.env` (no leading/trailing whitespace on the
value — the config loader trims, but keep the file clean):

```
SLACK_SIGNING_SECRET=<signing secret>
SLACK_BOT_TOKEN=xoxb-...
```

Never commit `.env`. If the signing secret leaks into a chat, terminal
paste, or PR diff, rotate it: **Basic Information** → **App
Credentials** → **Regenerate** next to Signing Secret.

### 4a. Fill in the rest of `.env`

The config loader (`packages/configuration/src/env.ts`) requires every
listed key to be present, even ones the current slice doesn't touch.
Missing keys throw a clear error at boot. Values you should set for
local dev:

```
AWS_REGION=us-east-1
SLACK_SIGNING_SECRET=<from step 4>
SLACK_BOT_TOKEN=xoxb-... (from step 4)
SLACK_RECOGNITION_CHANNEL_ID=C000000000     # placeholder until the report job needs a real channel
SLACK_MAINTAINER_IDS=U0BMM35KL72            # your Slack user ID (starts with U…)
PROGRAM_TIMEZONE=America/New_York
PROGRAM_START_AT=2026-07-31T00:00:00-04:00
DYNAMODB_TABLE_NAME=nominate-dev-unused     # placeholder until persistence lands
NOMINATION_QUEUE_URL=stdout://local         # logs the event instead of hitting SQS
```

Notes:

- `SLACK_MAINTAINER_IDS` is a comma-separated list of Slack **user IDs**
  (`U…`), not the org's team ID (`E…`) or workspace ID (`T…`). Copy your
  own user ID from Slack (profile → three-dot menu → **Copy member ID**)
  or from `slack auth list` (`User ID:` field). Multiple values look
  like `U0BMM35KL72,U0987654321`.
- `SLACK_RECOGNITION_CHANNEL_ID` and `DYNAMODB_TABLE_NAME` are required
  by the loader but unused by the current slice. Placeholders are fine
  until the report job and persistence code land.
- `NOMINATION_QUEUE_URL=stdout://local` selects the stdout publisher for
  local dev — the enqueued event is logged (description redacted) and a
  synthetic message ID is returned. Change to an `https://…sqs…` URL to
  publish to a real queue.

### 5. Start the local server and tunnel

Manifest defaults to `https://REPLACE_ME.example/slack/events`. Slack
won't dispatch to that. Start the local Lambda shim and expose it:

```bash
pnpm --filter @nominate/app-slack-ingress dev   # listens on :3000
```

In another terminal:

```bash
ngrok http 3000
```

### 6. Point the app at your tunnel

Two ways — pick one; both leave the same result:

**a. Edit `slack/manifest.json` locally (do not commit) and re-apply:**

Replace both `REPLACE_ME.example` URLs with `https://<tunnel>.ngrok-free.app`.
Then:

```bash
slack manifest validate
slack app install    # re-applies the local manifest to the linked app
```

`git checkout slack/manifest.json` afterward so the tunnel URL doesn't
end up on a branch.

**b. Edit request URLs in the dashboard:**

<https://api.slack.com/apps> → your app → **Slash Commands** → `/nominate`
→ set **Request URL** to `https://<tunnel>.ngrok-free.app/slack/events` →
save. Same for **Interactivity & Shortcuts**. Faster for one-off tunnel
rotations; if the manifest gains new fields later, the dashboard's manifest
view will flag drift.

### 7. Try `/nominate`

Invite the bot to a channel in your sandbox workspace, then type
`/nominate`. The modal should open. Troubleshooting:

- `ngrok` inspector shows the request arrive.
- Local server logs `slash_command_received`, not `slack_signature_rejected`.
- If Slack shows "`/nominate` failed with the error 'dispatch_failed'":
  URL mismatch. Re-check step 6.
- If the CLI fails at step 4 with an admin-approval error: approve the
  app request in the sandbox's org admin console, then re-run.

### 8. Update the manifest later

After editing `slack/manifest.json` (adding a scope, a shortcut, etc.):

```bash
slack manifest validate
slack app install    # re-applies to the linked app
```

Slack asks you to re-approve the app if a new scope was added.

## Path B — Slack dashboard

### 1. Create the app

1. Open <https://api.slack.com/apps>.
2. **Create New App** → **From an app manifest**.
3. Pick the target workspace.
4. Paste the contents of `slack/manifest.json`. Change
   `display_information.name` if you want (e.g. `Nominate (dev)`), and replace
   both `REPLACE_ME.example` request URLs with your tunnel URL from Step 3
   below (you'll come back after starting the tunnel).
5. **Next** → **Create**.

### 2. Grab the signing secret and bot token

- **Basic Information** → **App Credentials** → **Signing Secret** → copy.
- **Install App** → **Install to Workspace** → approve → copy the **Bot User
  OAuth Token** (`xoxb-…`).

Put both into your local `.env`:

```
SLACK_SIGNING_SECRET=<signing secret>
SLACK_BOT_TOKEN=xoxb-...
```

### 3. Start the local server and tunnel

From the repo root:

```bash
pnpm --filter @nominate/app-slack-ingress dev
```

In another terminal, expose it:

```bash
ngrok http 3000
```

Copy the HTTPS URL ngrok prints. The Slack ingress endpoint is at
`/slack/events` on that URL.

### 4. Set the request URLs

Back in the Slack app dashboard:

- **Slash Commands** → edit `/nominate` → set **Request URL** to
  `https://<tunnel>.ngrok-free.app/slack/events` → **Save**.
- **Interactivity & Shortcuts** → **Request URL** →
  `https://<tunnel>.ngrok-free.app/slack/events` → **Save**.

If you'd rather do this via the manifest, update `slack/manifest.json` with
the tunnel URL locally (do not commit this change) and paste it into
**App Manifest** → **Save Changes**.

### 5. Try `/nominate`

In your dev workspace, invite the bot to a channel and run `/nominate`. The
modal should open. If not, check:

- `ngrok` window shows the request.
- Server logs a `slash_command_received` line and no `slack_signature_rejected`.
- Slack app's slash command URL matches the current ngrok URL.

## Environment-specific apps

Dev, staging, and prod each get their own Slack app registration so that
signing secrets and OAuth tokens are isolated. Recommended: one Slack CLI
"environment" per Slack environment.

CLI approach:

```bash
# Staging — inside the target Slack workspace (a different sandbox
# workspace, or the corporate workspace once we move past sandbox):
slack login                            # if this is a new machine
slack app install --environment deployed  # links a second app entry
```

Before running `slack app install --environment deployed`, edit
`slack/manifest.json` locally to:

1. Set `display_information.name` to `Nominate (staging)` /
   `Nominate (prod)`.
2. Set both request URLs to the environment's API Gateway URL
   (`https://<api-id>.execute-api.<region>.amazonaws.com/slack/events`).

Revert the manifest after install (`git checkout slack/manifest.json`)
so those env-specific values never land on a branch.

Store the resulting signing secret and bot token in that environment's
AWS Secrets Manager entry — see `docs/09-security-privacy-audit.md
§Secrets`. The three apps track the same manifest schema; when we add a
scope or a new interaction, we bump `slack/manifest.json` in a PR and
re-run `slack app install --environment ...` per environment as part of
the release checklist.

Dashboard approach for the same result — paste the manifest into the
**From an app manifest** flow with the environment-specific name and
URLs; see Path B above.

## Rules that apply to any path

- **Never** commit real signing secrets or bot tokens. The `.env` file is
  gitignored; production credentials belong in AWS Secrets Manager
  (`docs/09-security-privacy-audit.md`).
- **Never** commit tunnel URLs into `slack/manifest.json`. The checked-in
  manifest uses `https://REPLACE_ME.example/slack/events` placeholders.
  Substitution happens at install time.
- Only add scopes when they're actually needed. Phase 1 needs exactly
  `commands`, `chat:write`, `users:read` (`docs/03-slack-app-design.md`).
- If you install a new dev app, re-run `slack app install` (Path A) or paste
  the manifest into the dashboard (Path B). Do not hand-edit settings out of
  band — the manifest should stay authoritative.
