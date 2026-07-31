# Future-State Backlog

Items in this file are not part of Phase 1 unless explicitly promoted through a documented scope change.

## Nomination invalidation

### Approved future behavior

Authorized maintainers may invalidate a nomination when it was accidental, assigned to the wrong recipient, technically duplicated, inappropriate, or otherwise ineligible.

Invalidation must:

- Preserve the original nomination for audit purposes.
- Exclude it from report scoring.
- Exclude its description from winner DMs.
- Record who invalidated it, when, and why.
- Restore the nominator's eligibility for the same recipient immediately.

### DynamoDB transaction

The future operation should atomically:

1. Change nomination status to `INVALIDATED`.
2. Add invalidation metadata.
3. Delete or supersede the active eligibility item for the pair.
4. Add an append-only audit event.

The entire operation must succeed or fail as one transaction. Repeated requests must be idempotent.

### Future fields

```ts
type NominationStatus = "ACTIVE" | "INVALIDATED";

interface InvalidationMetadata {
  invalidatedAt: string;
  invalidatedBySlackId: string;
  invalidationReason: string;
}
```

### Future interface options

- Maintainer-only Slack command.
- Slack App Home administration surface.
- Message action from a maintainer nomination list.
- Authenticated administration portal.

The interface may change without changing the approved domain behavior.

## Edit an existing nomination description

When a nominator hits the 14-day repeat window today the modal blocks
them entirely (`docs/03 §Modal` + the ingress pre-check). A friendlier
option is to let them **update the description on the existing
nomination** for the same recipient within the same window instead of
rejecting outright.

### Feasibility

The data path is straightforward:

- The active eligibility row already carries `nominationId`
  (`packages/domain/src/entities/Eligibility.ts`), so the ingress can
  resolve the pair to a specific nomination.
- `NominationRepository.findById` already exists and returns the full
  `description` field. Prefilling the modal's `plain_text_input` with
  its `initial_value` is a one-line change.

### Product / audit questions to resolve first

- **Do edits preserve or replace the description in the report?** If
  edits change what shows up in winner DMs, we need an
  `editedAt` / `editedByNominatorSlackId` audit trail plus a decision
  on whether the report uses the latest or original text. Simplest v1:
  latest text wins, original stored in a history list for audit.
- **Does an edit reset the 14-day clock?** Almost certainly no — the
  eligibility rule is about preventing repeated recognitions, not
  repeated edits. Keep `nextEligibleAtEpoch` frozen at the original
  `acceptedAt + 14d`.
- **What's the UX signal?** The modal should make it obvious it's an
  edit, not a new nomination. Options: swap the submit button text to
  "Update" when prefilled, or show a context block ("You're editing
  your recognition of @X from July 30").
- **Character-count limits.** Same 10–1000 range applies. No new
  validation.
- **Logging.** `docs/09 §Logging` still bans logging the description,
  so the edit event log carries `nominationId` + `editedAt` but not
  the before/after text.

### Suggested data model change

Add an optional `descriptionHistory: Array<{ text: string;
recordedAt: string }>` to the NOMINATION item, or (cleaner) store edits
as sibling `NOMINATION_EDIT#<epoch>` rows under the same partition and
keep the primary NOMINATION row as the current-truth pointer. The
sibling-row shape stays cleanly atomic with `TransactWriteItems` and
plays well with the invalidation flow already sketched above.

### Interaction with maintainer invalidation

If **Nomination invalidation** ships first, an invalidated nomination
must NOT be edit-eligible — the modal should treat an INVALIDATED
status the same as no active nomination. Adds one status check on the
findById path.

Not blocking Phase 1. Promote when the repeat-window rejection becomes
a real complaint (right now the modal-hint + inline reject already
recovers most of the UX loss).

## Inappropriate-language blocklist

Consider a future validation layer that detects configured terms before storage.

Requirements should include:

- Configurable term list.
- Case and basic character normalization.
- Neutral prompt asking the nominator to revise.
- No storage or logging of the rejected full description.
- Metrics for rejection count without sensitive content.
- Human review and invalidation remain available because filters are imperfect.

## Maintainer administration

On-demand biweekly report republish is already implemented as
`/kudos-admin report` (`apps/slack-ingress/src/routes/adminReport.ts`).

Remaining potential capabilities:

- View nomination metadata.
- Trace a description to a nominator for misconduct review.
- Invalidate and restore nominations (see **Nomination invalidation** above for the approved domain behavior).
- Retry failed winner DMs on demand (the report Lambda already re-attempts on the next execution — this is about surfacing a manual retry).
- Change channel, schedule, and timezone at runtime rather than via `terraform apply`.
- Review report execution history.

## Additional Slack entry points

`/kudos-admin` already covers the administrative slash command entry
point (`slack/manifest.json`).

Remaining entry points to consider:

- Message shortcut that pre-populates context from a Slack message.
- App Home nomination entry point (`home_tab_enabled` is currently `false` in the manifest).

## Multi-workspace distribution

Future work for broader installation:

- Full OAuth installation lifecycle.
- Per-workspace encrypted token storage.
- Installation revocation and cleanup.
- Tenant-level configuration.
- Slack Marketplace review and documentation.
- Billing or support model if applicable.

## Live eligibility integration coverage via Developer Program sandbox

Phase 1 covers guest, external / Slack Connect, bot, and deactivated
recipient rejection with unit tests that mock `users.info` responses. A
Slack Developer Program sandbox
(<https://docs.slack.dev/tools/developer-sandboxes/>) is an Enterprise Grid
org that supports guests, Slack Connect (between sandboxes), and admin
APIs — enough surface area to exercise those rejection paths against real
Slack in an integration suite.

Not required for Phase 1 shipping. Consider promoting when the domain
service touches eligibility logic in ways unit tests can't validate
(e.g. relying on undocumented `users.info` fields, or when a real Slack
error surface starts mattering for user-visible messaging). See
`docs/18-slack-app-setup.md §When to use a Developer Program sandbox` for
the trade-off summary.

## CI-driven Terraform deploys

`deploy.yml` is a `workflow_dispatch`-only placeholder today. Manual
`terraform apply` from an operator laptop is the source of truth in
Phase 1. Before deploys can actually run through GitHub Actions the
workflow needs:

- Backend values (`backend.hcl` is gitignored per ADR-006) materialized
  on the runner. Two GitHub environment secrets per env
  (`TF_BACKEND_BUCKET`, `TF_BACKEND_KEY`) plus a step that writes them
  into `backend.hcl` at runtime is the shape.
- `terraform init` in `plan` and `apply` steps needs the resulting
  `-backend-config=backend.hcl`.
- OIDC assume-role for AWS credentials. The `permissions: id-token: write`
  is already there, but the corresponding IAM role trust policy and
  `aws-actions/configure-aws-credentials` step are not.
- A plugin cache (`TF_PLUGIN_CACHE_DIR` + `actions/cache`) to keep the
  sequential `terraform init` calls in `ci.yml` from redownloading the
  AWS provider each time. Not blocking today, but a transient timeout on
  one of the ~11 module inits already tripped CI once
  (2026-07-30, self-resolved on re-run).

Promote when we want to remove the "manual `terraform apply`" step from
`docs/14 §Deployment order`.

## Align bootstrap and upload script defaults with the new project name

Historical context: production was renamed from `nominate-slackbot` to
`kudosbot` in July 2026. Dev was left on the old name to avoid a
destructive re-provision. The scripts under `scripts/` that build
resource names — `bootstrap-tfstate.sh`, `bootstrap-artifacts.sh`,
`upload-lambda-stubs.sh`, `upload-lambdas.sh` — still default to
`PROJECT="${PROJECT:-nominate-slackbot}"`. Prod-scoped invocations
therefore need an explicit `PROJECT=kudosbot` prefix.

Dev-only helper scripts (`scripts/dev/*.mjs`) already resolve per-env
via `scripts/dev/lib/project.mjs`, so this backlog item is scoped to
the four bootstrap/upload shell scripts.

When to promote: either (a) dev is also renamed to `kudosbot` (then
flip the defaults and delete the env-map from `project.mjs`), or (b)
we grow tired of typing `PROJECT=kudosbot` for prod operations (then
introduce the same per-env resolution in the shell scripts).

## Enhanced reporting

Possible additions:

- Department summaries.
- Participation trends.
- Historical dashboards.
- Exportable aggregate reports.
- Configurable report copy.

Do not introduce weighted scoring without a separate product decision.
