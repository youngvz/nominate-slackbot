# Scheduling and Reporting

## Timezone and anchor

All user-facing schedules use `America/New_York`.

- Program start: Friday, July 31, 2026 at 12:00 AM.
- First reminder: Friday, August 7, 2026 at 9:00 AM.
- First report: Friday, August 14, 2026 at 12:00 PM.

Use EventBridge Scheduler timezone-aware schedules rather than converting these times to a permanent UTC offset.

## Weekly reminder

- Runs every Friday at 9:00 AM local time.
- Posts to the single configured recognition channel.
- Encourages employees to use `/kudos`.
- Uses an execution key derived from workspace and scheduled time.
- A retry must not create a duplicate reminder.

## Biweekly report

- Runs every other Friday at 12:00 PM local time.
- The first report runs August 14, 2026.
- Reporting windows are fixed and half-open: `[start, end)`.
- Eligibility remains rolling and is not reset at report boundaries.

## First period

```text
Start: 2026-07-31 00:00 America/New_York, inclusive
End:   2026-08-14 12:00 America/New_York, exclusive
```

A nomination at exactly August 14 at 12:00 PM belongs to the second period.

## Aggregation

1. Query valid nominations for the period.
2. Group by recipient Slack ID.
3. Count one point per nomination.
4. Determine the maximum count.
5. Publish all recipients whose count equals the maximum.
6. If there are no nominations, publish a no-activity message.

## Public message

The public report contains:

- Winner or tied winner mentions.
- Nomination count per winner.
- A short recognition message.

It excludes:

- Nominator identities.
- Nomination descriptions.

## Winner DMs

After the public report is recorded as published:

- Send each winner only their descriptions.
- Do not reveal nominators.
- Track each DM attempt separately.
- Retry retryable failures.
- Do not duplicate a successfully delivered DM.
- Do not roll back the public report if a DM fails.

## Idempotency state

Create a report execution item keyed by workspace and period start. Track:

- `PENDING`
- `PUBLISHED`
- `PARTIAL_DM_FAILURE`
- `COMPLETED`
- `FAILED`

Persist the public Slack message timestamp and per-winner DM state.

```mermaid
stateDiagram-v2
    [*] --> PENDING: ensurePendingExecution (conditional put)

    PENDING --> PUBLISHED: channel post succeeded<br/>(record Slack ts)
    PENDING --> FAILED: unrecoverable error<br/>before publication

    PUBLISHED --> COMPLETED: all winner DMs delivered
    PUBLISHED --> PARTIAL_DM_FAILURE: one or more DMs<br/>retryably failed

    PARTIAL_DM_FAILURE --> COMPLETED: retry succeeds
    PARTIAL_DM_FAILURE --> PARTIAL_DM_FAILURE: retry still partial

    COMPLETED --> [*]
    FAILED --> [*]

    note right of PUBLISHED
        Public message is not rolled back
        if downstream DM delivery fails.
    end note
```

*Anchored in `apps/report-job/src/runReport.ts` (`ensurePendingExecution`, `ensurePublished`, `deliverWinnerDms`) and `packages/persistence/src/repositories/ReportRepository.ts` (state field updates via conditional put + update).*

## Scheduled input contract

The EventBridge Scheduler `report` target is configured with no `input`
block, so scheduled invocations arrive at the report Lambda with an empty
JSON body (`{}`). `apps/report-job/src/resolveReportEvent.ts` bridges this
gap:

- `workspaceId` — falls back to the `REPORT_WORKSPACE_ID` env var (set per
  environment via the compute module). Missing env var → the Lambda throws
  `UnresolvableReportEventError("MISSING_WORKSPACE")` and EventBridge retries
  per its policy.
- `periodStart` / `periodEnd` — falls back to
  `mostRecentClosedPeriod(now)`. A schedule that fires exactly at a period
  boundary reports on the period that just closed. A late fire (retry after
  the boundary) still resolves to the same window because the helper steps
  back one millisecond before delegating to `periodContaining`.
- `scheduledAt` — falls back to `new Date(now).toISOString()`.
- `executionKey` — falls back to `${workspaceId}#${periodStart}` for log
  correlation and idempotency keying.

Admin invocations (`/kudos-admin report`, docs/03 §Admin surface) send a
fully-populated envelope with `forceRepublish: true`; the resolver returns
those values unchanged. Every retry — scheduled or admin — hits the same
idempotency guards in `runReport` regardless of the resolution path.

## Dev-only anchor overrides

`PROGRAM_START_AT` and `FIRST_REPORT_AT` are read at module load in
`packages/domain/src/value/ReportingPeriod.ts`; when either is set to a valid
ISO-8601 timestamp, it replaces the corresponding hard-coded anchor. This
lets dev environments shift the first reporting period earlier so pre-launch
test nominations land inside a real window. Production must never set these
overrides — the Terraform default for `first_report_at` is the empty string,
which suppresses the env var entirely. Set both together when overriding
(`first_report_at = program_start_at + 14 days at 12:00 local`) so the first
period stays half-open per §First period.

## Admin on-demand runs

`/kudos-admin report` (docs/03 §Admin surface) invokes the report Lambda outside the schedule for the current period, with `forceRepublish: true`. In that mode `runReport` unconditionally overwrites the execution row back to `PENDING`, re-posts to the recognition channel, and re-sends winner DMs. Scheduled EventBridge runs must never set `forceRepublish`; they continue to observe the state machine above and are idempotent across retries.

## Schedule failure behavior

- EventBridge retries according to configured policy.
- The target may use a DLQ where supported.
- Duplicate invocations resolve through conditional report/reminder execution records.
- Alarms notify operators when publication or winner delivery remains incomplete.
