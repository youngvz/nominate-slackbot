# scheduling module

EventBridge Scheduler schedules for the weekly reminder and biweekly report.

Reference: `docs/07-aws-infrastructure.md` §Scheduling; `docs/10-scheduling-and-reporting.md`. All schedules use `America/New_York`.

- Reminder: `cron(0 9 ? * FRI *)` in the program timezone.
- Report: `rate(14 days)` anchored on `report_first_run_at`. Cron cannot express "every other Friday" natively; `rate` avoids the DST-conversion problem that a UTC cron would introduce.

Each schedule assumes a scoped IAM role that can only invoke its target Lambda.

Follow-up: EventBridge Scheduler dead-letter target is intentionally out of scope. Alarm coverage in the `observability` module (Lambda errors, DLQ depth) provides partial signal until a dead-letter target is added.

## Inputs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `project` | string | — | Project prefix. |
| `environment` | string | — | Environment name. |
| `timezone` | string | `America/New_York` | Schedule timezone. |
| `reminder_target_arn` | string | — | Reminder Lambda ARN. |
| `report_target_arn` | string | — | Report Lambda ARN. |
| `reminder_first_run_at` | string | `2026-08-07T09:00:00` | First-run anchor for reminder. |
| `report_first_run_at` | string | `2026-08-14T12:00:00` | First-run anchor for report. |
| `tags` | map(string) | `{}` | Tags. |

## Outputs

| Name | Description |
| --- | --- |
| `reminder_schedule_arn` | Reminder schedule ARN. |
| `report_schedule_arn` | Report schedule ARN. |
