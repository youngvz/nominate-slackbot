# ADR-007: Recognize every nominated recipient, not only top-count winners

## Status

Accepted.

## Decision

The biweekly public report names every teammate who received at least one valid nomination in the period, and each of those teammates receives a private DM with the descriptions written about them. Nomination counts remain informational (retained in DynamoDB and used to shape the DM copy) but no longer filter who is publicly named or who is privately DMed.

Concretely:

- `packages/slack/src/blocks/reportMessage.ts` takes `recipientSlackIds: readonly string[]` and renders a single "Shoutout to the teammates recognized by their coworkers this period" section that lists every recipient. No single-winner vs. tied-winner branching. No counts.
- `apps/report-job/src/runReport.ts` derives the recipient list from `Object.keys(countsBySlackId)` — not from `tallyWinners` — and iterates it for both the public post and the DM loop.
- The `ReportExecutionItem.winnerSlackIds` and `WinnerDmDelivery` types keep their current names for this change to bound the diff; a follow-up PR renames them to `recipientSlackIds` / `RecipientDmDelivery` and removes the now-unused `tallyWinners` and `Winner` from `packages/domain`.

## Rationale

The prior "winner" framing surfaced two problems:

1. Leaderboard language ("won", "top spot", "tied for the top") encourages competition. Recognition is meant to reinforce peer appreciation, not create a scoreboard some teammates chase.
2. Filtering the public post to top-count recipients erased anyone with fewer nominations. A teammate who received a single, thoughtful nomination was invisible in the public report — the least-visible teammates were the ones the current mechanism explicitly hid.

Naming every recipient repositions the report as "here is who your peers noticed this period," which matches the program's intent. Counts stay in the private DM (multi-nomination winners still see "recognized 3 times") so the extra recognition isn't lost, but the public post treats each recognized teammate as equally worth celebrating.

## Consequences

- More names in the public post during active periods. This is a feature, not a defect — the message is expected to grow with participation.
- More DM volume per period. Delivery tracking is already per-recipient in `ReportExecutionItem.dmDeliveries`; no infrastructure change is required.
- Log field/event names in `runReport.ts` shift from `winnerCount` → `recipientCount` and `winner_dm_sent/failed` → `recipient_dm_sent/failed`. Neither key is referenced by infra alarms or dashboards today.
- `tallyWinners` and the `Winner` domain entity become unused. Left in place here; scheduled for removal in the follow-up rename PR to keep this diff scoped.
- Field name `winnerSlackIds` on `ReportExecutionItem` now stores every recipient's Slack ID rather than only top-count winners. Storage layout unchanged; rename scheduled for the follow-up.
- Deterministic ordering: recipient IDs are sorted ascending by Slack ID before rendering so retries produce byte-identical Slack messages.
