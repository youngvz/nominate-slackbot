#!/usr/bin/env node
// Preview what a report over a given window would produce: counts by
// recipient, max count, and everyone tied at max ("winners"). Does not invoke
// the report Lambda and does not touch Slack. Same GSI1 query as the report.
//
// Defaults to the currently OPEN period, unlike dev:report which targets the
// most-recently-CLOSED one. Pass --closed to snap to the same window
// dev:report would compute, or --period-start / --period-end for a custom range.
//
// Usage:
//   pnpm dev:period
//   pnpm dev:period --closed
//   pnpm dev:period --period-start 2026-07-16T04:00:00Z --period-end 2026-07-31T02:00:00Z
//   pnpm dev:period --full         # show untruncated descriptions in the detail table
//   pnpm dev:period --format json

import {
  fetchLambdaEnv,
  resolveWindow,
  createDynamoClient,
  queryNominationsInWindow,
  renderDescription,
} from "./lib/nominations.mjs";
import { projectFor } from "./lib/project.mjs";

const PERIOD_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const out = { env: "dev", format: "table", full: false, closed: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--period-start":
      case "--period-end":
      case "--env":
      case "--format":
        out[key.slice(2)] = argv[++i];
        break;
      case "--full":
        out.full = true;
        break;
      case "--closed":
        out.closed = true;
        break;
      case "--help":
      case "-h":
        out.help = true;
        break;
      default:
        throw new Error(`Unknown flag: ${key}`);
    }
  }
  if (!["json", "table"].includes(out.format)) {
    throw new Error(`--format must be json or table (got ${out.format})`);
  }
  return out;
}

function usage() {
  console.log(`Usage:
  pnpm dev:period [--closed] [--period-start ISO --period-end ISO] [--full] [--format json|table] [--env dev|production]

Defaults:
  window        currently open reporting period
                --closed             → most-recently-closed period (what dev:report would use)
                --period-start/--end → custom window
  --format      table
  descriptions  truncated to 40 chars (pass --full to un-redact)
  --env         dev
`);
}

function mostRecentClosedPeriod(nowEpochMs, programStartMs, firstReportMs) {
  if (nowEpochMs < firstReportMs) return null;
  const offset = nowEpochMs - firstReportMs;
  const n = Math.floor(offset / PERIOD_LENGTH_MS);
  const boundary = firstReportMs + n * PERIOD_LENGTH_MS;
  const start = n === 0 ? programStartMs : boundary - PERIOD_LENGTH_MS;
  return {
    startEpochMs: start,
    endEpochMs: boundary,
    start: new Date(start).toISOString(),
    end: new Date(boundary).toISOString(),
    source: "most-recently-closed",
  };
}

function buildCounts(nominations) {
  const counts = new Map();
  const perRecipient = new Map();
  for (const n of nominations) {
    counts.set(n.recipientSlackId, (counts.get(n.recipientSlackId) ?? 0) + 1);
    const bucket = perRecipient.get(n.recipientSlackId) ?? [];
    bucket.push(n);
    perRecipient.set(n.recipientSlackId, bucket);
  }
  let max = 0;
  for (const c of counts.values()) if (c > max) max = c;
  const winners = [];
  for (const [id, c] of counts) if (c === max) winners.push(id);
  winners.sort();
  return { counts, perRecipient, max, winners };
}

function tableOfCounts(counts) {
  const rows = [...counts.entries()]
    .map(([recipient, count]) => ({ recipient, count }))
    .sort((a, b) => b.count - a.count || a.recipient.localeCompare(b.recipient));
  if (rows.length === 0) return "(no nominations in window)";
  const cols = ["recipient", "count"];
  const widths = Object.fromEntries(
    cols.map((c) => [
      c,
      Math.max(c.length, ...rows.map((r) => String(r[c]).length)),
    ]),
  );
  const line = (r) =>
    cols.map((c) => String(r[c]).padEnd(widths[c])).join("  ");
  const header = line(Object.fromEntries(cols.map((c) => [c, c])));
  const sep = cols.map((c) => "-".repeat(widths[c])).join("  ");
  return [header, sep, ...rows.map(line)].join("\n");
}

function tableOfDetails(nominations, showFull) {
  if (nominations.length === 0) return "";
  const rows = nominations.map((n) => ({
    submittedAt: n.submittedAt,
    nominator: n.nominatorSlackId,
    recipient: n.recipientSlackId,
    description: renderDescription(n.description, showFull),
  }));
  const cols = ["submittedAt", "nominator", "recipient", "description"];
  const widths = Object.fromEntries(
    cols.map((c) => [
      c,
      Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)),
    ]),
  );
  const line = (r) =>
    cols.map((c) => String(r[c] ?? "").padEnd(widths[c])).join("  ");
  const header = line(Object.fromEntries(cols.map((c) => [c, c])));
  const sep = cols.map((c) => "-".repeat(widths[c])).join("  ");
  return [header, sep, ...rows.map(line)].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const env = args.env ?? "dev";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const functionName = `${projectFor(env)}-${env}-report`;
  const lambdaEnv = await fetchLambdaEnv(functionName, region);

  let window;
  if (args["period-start"] || args["period-end"]) {
    window = resolveWindow(args, lambdaEnv);
  } else if (args.closed) {
    const programStartMs = Date.parse(lambdaEnv.PROGRAM_START_AT);
    const firstReportMs = Date.parse(lambdaEnv.FIRST_REPORT_AT);
    window = mostRecentClosedPeriod(Date.now(), programStartMs, firstReportMs);
    if (!window) {
      throw new Error(
        `No closed period yet — now is before FIRST_REPORT_AT (${lambdaEnv.FIRST_REPORT_AT}).`,
      );
    }
  } else {
    window = resolveWindow(args, lambdaEnv);
  }

  const dynamo = createDynamoClient(region);
  const nominations = await queryNominationsInWindow(dynamo, {
    tableName: lambdaEnv.DYNAMODB_TABLE_NAME,
    workspaceId: lambdaEnv.REPORT_WORKSPACE_ID,
    startEpochMs: window.startEpochMs,
    endEpochMs: window.endEpochMs,
  });
  const summary = buildCounts(nominations);

  if (args.format === "json") {
    const countsObj = {};
    for (const [id, c] of summary.counts) countsObj[id] = c;
    console.log(
      JSON.stringify(
        {
          env,
          workspaceId: lambdaEnv.REPORT_WORKSPACE_ID,
          window: { source: window.source, start: window.start, end: window.end },
          total: nominations.length,
          countsByRecipient: countsObj,
          maxCount: summary.max,
          winners: summary.winners,
          nominations: nominations.map((n) => ({
            submittedAt: n.submittedAt,
            nominator: n.nominatorSlackId,
            recipient: n.recipientSlackId,
            description: renderDescription(n.description, args.full),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    `env: ${env}   workspace: ${lambdaEnv.REPORT_WORKSPACE_ID}   window: ${window.source} [${window.start}, ${window.end})   total: ${nominations.length}   max: ${summary.max}   winners: ${summary.winners.join(", ") || "(none)"}`,
  );
  console.log("\ncounts by recipient:");
  console.log(tableOfCounts(summary.counts));
  console.log("\nnominations:");
  console.log(tableOfDetails(nominations, args.full));
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
