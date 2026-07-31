import { randomUUID } from "node:crypto";
import { PROGRAM_TIMEZONE, periodContaining } from "@nominate/domain";
import type { BiweeklyReportRequestedV1 } from "@nominate/contracts";
import type { Logger } from "@nominate/observability";
import type { SlashCommandPayload } from "@nominate/slack";

// docs/03 §Admin surface. `/kudos-admin report` invokes the report Lambda
// on demand with `forceRepublish: true` so demos can re-post the current
// period regardless of prior state. Scheduled EventBridge runs never set that
// flag and continue to honor the PUBLISHED idempotency guard.

export interface AdminReportInvoker {
  invokeReport(event: BiweeklyReportRequestedV1): Promise<void>;
}

export interface AdminReportDeps {
  invoker: AdminReportInvoker;
  maintainerAllowlist: readonly string[];
  respond: (input: { responseUrl: string; text: string }) => Promise<void>;
  logger: Logger;
  now: () => number;
}

export interface AdminReportResult {
  outcome: "invoked" | "unauthorized" | "unknown_subcommand" | "error";
  ephemeralText: string;
}

export async function handleAdminCommand(
  payload: SlashCommandPayload,
  deps: AdminReportDeps,
): Promise<AdminReportResult> {
  const log = deps.logger.child({
    workspaceId: payload.teamId,
    eventType: "admin_slash_command",
  });

  if (!deps.maintainerAllowlist.includes(payload.userId)) {
    log.warn("admin_command_denied", {
      outcome: "unauthorized",
      actor: payload.userId,
    });
    return {
      outcome: "unauthorized",
      ephemeralText:
        "You're not on the maintainer allowlist for this app. Ask an owner to add your Slack ID.",
    };
  }

  const [subcommand, ...rest] = payload.text.trim().split(/\s+/);
  const args = rest.join(" ");

  switch (subcommand) {
    case "report":
      return runReport({ payload, args, deps, log });
    case "":
    case "help":
      return {
        outcome: "unknown_subcommand",
        ephemeralText: adminHelpText(),
      };
    default:
      log.info("admin_command_unknown_subcommand", {
        outcome: "unknown_subcommand",
        subcommand,
      });
      return {
        outcome: "unknown_subcommand",
        ephemeralText: `Unknown subcommand \`${subcommand}\`. ${adminHelpText()}`,
      };
  }
}

interface RunReportArgs {
  payload: SlashCommandPayload;
  args: string;
  deps: AdminReportDeps;
  log: Logger;
}

async function runReport({
  payload,
  args: _args,
  deps,
  log,
}: RunReportArgs): Promise<AdminReportResult> {
  const nowMs = deps.now();
  const period = periodContaining(nowMs);

  const scheduledAt = new Date(nowMs).toISOString();
  const event: BiweeklyReportRequestedV1 = {
    eventType: "report.biweekly.requested",
    schemaVersion: 1,
    workspaceId: payload.teamId,
    scheduledAt,
    periodStart: period.start,
    periodEnd: period.end,
    // Executions triggered on-demand keep the same periodStart so the row is
    // reused, but the executionKey includes a fresh UUID for log correlation.
    executionKey: `${payload.teamId}#${period.start}#admin-${randomUUID()}`,
    forceRepublish: true,
  };

  try {
    await deps.invoker.invokeReport(event);
    log.info("admin_report_invoked", {
      outcome: "invoked",
      actor: payload.userId,
      periodStart: period.start,
      periodEnd: period.end,
    });
    return {
      outcome: "invoked",
      ephemeralText: buildInvokedMessage(period.start, period.end),
    };
  } catch (err) {
    log.error("admin_report_invocation_failed", {
      outcome: "error",
      actor: payload.userId,
      errorCategory: err instanceof Error ? err.name : "unknown",
    });
    return {
      outcome: "error",
      ephemeralText:
        "Report invocation failed — check the ingress logs for details.",
    };
  }
}

const PERIOD_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: PROGRAM_TIMEZONE,
  month: "short",
  day: "numeric",
});

function buildInvokedMessage(periodStartIso: string, periodEndIso: string): string {
  const start = PERIOD_FORMATTER.format(new Date(Date.parse(periodStartIso)));
  const end = PERIOD_FORMATTER.format(new Date(Date.parse(periodEndIso)));
  return `Kicking off an on-demand report for the current period (${start} – ${end}). It will re-post to the recognition channel and re-send winner DMs.`;
}

function adminHelpText(): string {
  return "Available subcommands: `/kudos-admin report` — publish the biweekly report for the current period on demand.";
}
