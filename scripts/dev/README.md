# Dev test scripts

Direct-invoke helpers for the deployed dev Lambdas. Use them when you need to
exercise a code path end-to-end without going through the Slack UI.

Both scripts read the deployed Lambda's env vars via
`GetFunctionConfiguration` so they always target the same queue / workspace /
channel the Lambda itself is using — no hard-coded URLs to drift.

## Prerequisites

- AWS credentials with `lambda:GetFunctionConfiguration`, `sqs:SendMessage`,
  `lambda:InvokeFunction`, and `secretsmanager:GetSecretValue` (list-users
  only) on the dev resources.
- Bot must be a member of the recognition channel (`C0BLPEB8H6Z`).
- Nominator + recipient must be real users in the sandbox workspace
  (`T0BLQP0VAGN`). Use `pnpm dev:nominate --help` for defaults, or
  `pnpm dev:users` to discover valid IDs.

## list-users.mjs → `pnpm dev:users`

Calls `users.list` against the workspace and prints every non-bot,
non-deleted member. Reads the bot token from the ARN referenced by the
report Lambda so no plaintext token is needed. Grid installs require a
`team_id`; the script pulls it from `REPORT_WORKSPACE_ID` and accepts
`--workspace` to override.

```
pnpm dev:users                       # table, sandbox workspace, humans only
pnpm dev:users --format json         # for scripting downstream
pnpm dev:users --all                 # include bots, deleted users, Slackbot
pnpm dev:users --workspace T012345   # different workspace in the same org
```

## enqueue-nomination.mjs → `pnpm dev:nominate`

Sends a `NominationSubmissionRequestedV1` message onto the nomination SQS
queue. The worker Lambda runs the full pipeline (eligibility, transact write,
idempotency, feedback DM) — same code as prod.

The **nominator** gets a DM confirming the nomination (or explaining a
rejection). The recipient does *not* get a DM at this stage — that happens
when the report Lambda runs and identifies them as a winner.

`--recipient` defaults to the first ID in the target Lambda's
`SLACK_MAINTAINER_IDS`. Override when you want to test a non-maintainer path.

```
pnpm dev:nominate --nominator U0BLQNZCN22
pnpm dev:nominate --nominator U0BLPE9N7EZ --description "Ran a great retro"
pnpm dev:nominate --nominator U0BLBBN69CP --recipient U0BLQNZPR8W
```

## invoke-report.mjs → `pnpm dev:report`

Invokes the report Lambda with a `BiweeklyReportRequestedV1` envelope. By
default it targets the most-recently-closed period and sets
`forceRepublish=true`, matching the `/nominate-admin report` path.

The winner (highest nomination count in the period) gets a DM listing every
description their nominators wrote — this is the DM under test.

```
pnpm dev:report                     # async, current period, forceRepublish=true
pnpm dev:report --sync              # wait for the Lambda + print tail logs
pnpm dev:report --no-force          # respect existing PUBLISHED state
pnpm dev:report --period-start 2026-07-16T00:00:00-04:00 \
                --period-end   2026-07-30T18:00:00-04:00
```

## inspect-recipient.mjs → `pnpm dev:recipient`

Lists every nomination a given recipient received in a window, with nominator
IDs and (truncated) descriptions. Uses the same GSI1 the report Lambda
queries. Defaults to the currently OPEN period — for "what's building up
right now" — so it complements `dev:report` (closed period).

```
pnpm dev:recipient                              # you (first SLACK_MAINTAINER_IDS), current open period
pnpm dev:recipient --recipient U0BLQNZCN22
pnpm dev:recipient --full                       # show full descriptions
pnpm dev:recipient --period-start 2026-07-16T04:00:00Z \
                   --period-end   2026-07-31T02:00:00Z
pnpm dev:recipient --format json                # pipeable
```

Descriptions are truncated to 40 chars by default (docs/09 §Logging — treat
them as PII); `--full` un-redacts.

## inspect-period.mjs → `pnpm dev:period`

Previews what the report would produce over a window — counts per recipient,
max count, tied winners — without invoking the report Lambda and without
posting to Slack. Great for confirming a demo landscape before firing
`dev:report`.

```
pnpm dev:period                                 # currently open period
pnpm dev:period --closed                        # what dev:report would target
pnpm dev:period --period-start 2026-07-16T04:00:00Z \
                --period-end   2026-07-31T02:00:00Z
pnpm dev:period --full                          # detail table with full descriptions
pnpm dev:period --format json
```

## clear-eligibility.mjs → `pnpm dev:clear-eligibility`

Delete a `PAIR_ELIGIBILITY` row so a nominator can re-nominate immediately.
NOMINATION rows are untouched — the historical count stays intact.

Dev-only; refuses `--env production`. Two-phase — prints the plan without
`--yes`, deletes only when you pass `--yes`.

```
pnpm dev:clear-eligibility --nominator U0BLQNZCN22 --recipient U0BMM35KL72
pnpm dev:clear-eligibility --nominator U0BLQNZCN22 --recipient U0BMM35KL72 --yes
pnpm dev:clear-eligibility --nominator U0BLQNZCN22 --all --yes    # clear every recipient
```

## reset-period.mjs → `pnpm dev:reset-period`

Nuclear demo reset for a window: deletes every NOMINATION in the window, every
PAIR_ELIGIBILITY row anchored on any nominator in that window, and the
REPORT_EXECUTION row for the period.

Dev-only; refuses `--env production`. Two-phase — prints the plan without
`--yes`, deletes only when you pass `--yes`.

```
pnpm dev:reset-period                # current open period (plan only)
pnpm dev:reset-period --closed       # most-recently-closed
pnpm dev:reset-period --closed --yes # execute
pnpm dev:reset-period --period-start ISO --period-end ISO --yes
```

## invoke-reminder.mjs → `pnpm dev:reminder`

Invokes the reminder Lambda directly with the shape EventBridge Scheduler
would send at Friday 9 AM ET. Bot posts the weekly reminder in the
recognition channel.

```
pnpm dev:reminder            # async (matches scheduled path)
pnpm dev:reminder --sync     # wait for the Lambda + print tail logs
```

## tail-logs.mjs → `pnpm dev:tail`

Follows CloudWatch logs for all four dev Lambdas at once with a color-coded
prefix per source. Wraps `aws logs tail --follow`; requires the AWS CLI.

```
pnpm dev:tail                # all four
pnpm dev:tail --only worker  # substring match: ingress | worker | report | reminder
pnpm dev:tail --since 30m    # rewind before tailing (default 5m)
```

Ctrl-C stops all children.

## End-to-end DM smoke test

```bash
# Six of the sandbox users nominate you (U0BMM35KL72). Repeat for each user
# you want in the tally.
pnpm dev:nominate --nominator U0BLQNZCN22   # Eliza
pnpm dev:nominate --nominator U0BLPE9N7EZ   # Phillip
pnpm dev:nominate --nominator U0BLBBN69CP   # Sue
pnpm dev:nominate --nominator U0BLQNZPR8W   # Tim
pnpm dev:nominate --nominator U0BLSNJ9SJE   # Steven
pnpm dev:nominate --nominator U0BLWDGQD8U   # Rosario

# Wait a few seconds for the SQS→worker pipeline to write to DynamoDB, then:
pnpm dev:report --sync
```

Expected: the recognition channel gets a "Recognition results" post
mentioning `<@U0BMM35KL72>`, and Slackbot delivers a DM to you with the six
descriptions from the nominators.
