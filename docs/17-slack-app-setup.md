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

The CLI needs a `.slack/` project directory pointing at our manifest. Run
once from the repo root:

```bash
slack init
```

`slack init` creates `.slack/config.json`, `.slack/hooks.json`, and
`.slack/.gitignore`, and may add a Slack hooks dependency to `package.json`.
Before proceeding, edit `.slack/hooks.json` so its `get-manifest` hook
reads our checked-in file. Minimum viable contents for a
registration-only workflow (we run the Lambda handler ourselves via the
dev shim — we don't use `slack run`):

```json
{
  "hooks": {
    "get-manifest": "cat slack/manifest.json"
  }
}
```

We deliberately omit `start` / `build` / `deploy` hooks — the Slack CLI is
only used here for manifest + app-registration management, not to run the
app. `pnpm --filter @nominate/app-slack-ingress dev` remains the local
runtime.

Add `.slack/` to `.gitignore` if `slack init` didn't already — the
`config.json` inside it stores your machine-local app ID and should not be
committed.

### 3. Validate the manifest

```bash
slack manifest validate
```

Fix any reported errors before continuing.

### 4. Create the Slack app from the manifest

```bash
slack app install
```

Interactive prompts you should expect on a Grid / sandbox org:

- **App name / environment:** pick `local` (this is your dev app; a
  separate `deployed` environment will exist for staging/prod later).
- **Workspace to install to:** pick one workspace in your sandbox org.
  This is the org-workspace grant. You can add more workspaces later via
  the org admin console, or re-run `slack app install` with a different
  target.
- **Admin approval:** Admin Approval of Apps is on by default in Grid
  orgs. First install may trigger an Org Admin approval flow — approve
  it from the same Slack account if you're the org admin.

On success `slack app install` links the local project to the newly
created app. The signing secret and bot token are stored by Slack — the
CLI does not print them. Retrieve them with:

```bash
slack app link            # shows the linked app ID
```

Then in the browser: <https://api.slack.com/apps> → your app → **Basic
Information** → **Signing Secret** (Show); **Install App** → **Bot User
OAuth Token** (`xoxb-…`).

Put both into your local `.env`:

```
SLACK_SIGNING_SECRET=<signing secret>
SLACK_BOT_TOKEN=xoxb-...
```

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
