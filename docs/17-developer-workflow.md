# Developer Workflow

We don't run a ticket tracker on this repo, so the workflow is stripped down — but direct changes to `main` are not allowed. `dev` is the integration branch; commit directly to `dev` only when you need an escape hatch, otherwise open a PR into it. `main` receives merges from `dev` only and is treated as the release branch.

The Husky hooks enforce the branch rules locally:

- **pre-commit** blocks direct commits to `main`, warns on unrecognized branch prefixes, then runs `pnpm lint && pnpm typecheck`.
- **pre-push** blocks direct pushes to `main`, then runs `pnpm verify` (the same four checks CI runs — see [`14-deployment-and-environments.md`](14-deployment-and-environments.md) §CI checks).

## Branches

Cut from `dev` using `[prefix]/[optional-description]`:

- `feat/` — new feature or functionality
- `fix/` — bug fix
- `chore/` — internal maintenance, tooling, dev-loop work
- `task/` — change request or other tasks

Examples:

- `feat/slack-ingress-signature-check`
- `fix/eligibility-window-boundary`
- `chore/husky-hooks`

If you're working against a ticket, include it after the prefix (e.g. `feat/JIRA-123_add-route`); the pre-commit hook does not require it.

## Commits

- Write a clear message that describes the change. Prefer imperative mood ("add", "fix", "remove").
- If a commit spans multiple pieces of work, mention the secondary context in the body.
- Don't bypass hooks (`--no-verify`) unless there's a specific, defensible reason.

## Pull requests

- Open the PR against `dev`, not `main`.
- Title: short summary of the change. If a ticket exists, prefix it — e.g. `JIRA-123: add route` or `feat/JIRA-123 - add route`.
- Description: what changed and why, plus anything the reviewer should pay extra attention to. Example: "Created a new route for the screen. Old redirects needed to be modified, so please make sure they are still functional."
- Request review from the relevant peers.

## Merging

- `dev` → `main` promotions happen through a PR from `dev` after the changes on `dev` have been validated.
- Server-side branch protection on `main` (PR required, no direct pushes) is the backstop for the local hooks; configure it on the remote as soon as the branch is pushed.
