#!/usr/bin/env node
// List every nomination a specific recipient received, with nominator IDs and
// descriptions. Uses the same GSI1 the report Lambda queries. Defaults to the
// currently OPEN period (unlike dev:report, which targets the most-recently
// CLOSED one) — this script is for "what's building up right now."
//
// Descriptions are treated as PII (docs/09 §Logging); truncated to 40 chars
// unless --full is passed.
//
// Usage:
//   pnpm dev:recipient --recipient U0BMM35KL72
//   pnpm dev:recipient --recipient U0BMM35KL72 --full
//   pnpm dev:recipient --recipient U0BMM35KL72 \
//     --period-start 2026-07-16T04:00:00Z --period-end 2026-07-31T02:00:00Z
//   pnpm dev:recipient --recipient U0BMM35KL72 --format json
//   pnpm dev:recipient   # (no --recipient) defaults to first SLACK_MAINTAINER_IDS entry

import {
  fetchLambdaEnv,
  resolveWindow,
  createDynamoClient,
  queryNominationsInWindow,
  renderDescription,
} from "./lib/nominations.mjs";

function parseArgs(argv) {
  const out = { env: "dev", format: "table", full: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--recipient":
      case "--period-start":
      case "--period-end":
      case "--env":
      case "--format":
        out[key.slice(2)] = argv[++i];
        break;
      case "--full":
        out.full = true;
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
  pnpm dev:recipient [--recipient <U…>] [--period-start ISO --period-end ISO] [--full] [--format json|table] [--env dev|production]

Defaults:
  --recipient    first ID in the target Lambda's SLACK_MAINTAINER_IDS
  window         currently open reporting period
  --format       table
  descriptions   truncated to 40 chars (pass --full to un-redact)
  --env          dev
`);
}

function toTable(rows) {
  if (rows.length === 0) return "(no nominations)";
  const cols = ["submittedAt", "nominator", "description"];
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

function firstMaintainerId(csv) {
  if (!csv) return undefined;
  return csv.split(",").map((s) => s.trim()).find((s) => s.length > 0);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const env = args.env ?? "dev";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const functionName = `nominate-slackbot-${env}-report`;
  const lambdaEnv = await fetchLambdaEnv(functionName, region);
  const recipient =
    args.recipient ?? firstMaintainerId(lambdaEnv.SLACK_MAINTAINER_IDS);
  if (!recipient) {
    throw new Error(
      "No --recipient passed and SLACK_MAINTAINER_IDS on the report Lambda is empty.",
    );
  }
  const workspaceId = lambdaEnv.REPORT_WORKSPACE_ID;
  const window = resolveWindow(args, lambdaEnv);

  const dynamo = createDynamoClient(region);
  const all = await queryNominationsInWindow(dynamo, {
    tableName: lambdaEnv.DYNAMODB_TABLE_NAME,
    workspaceId,
    startEpochMs: window.startEpochMs,
    endEpochMs: window.endEpochMs,
  });
  const forRecipient = all.filter((n) => n.recipientSlackId === recipient);

  const rows = forRecipient.map((n) => ({
    submittedAt: n.submittedAt,
    nominator: n.nominatorSlackId,
    description: renderDescription(n.description, args.full),
  }));

  if (args.format === "json") {
    console.log(
      JSON.stringify(
        {
          env,
          workspaceId,
          recipient,
          window: {
            source: window.source,
            start: window.start,
            end: window.end,
          },
          count: rows.length,
          nominations: rows,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(
    `env: ${env}   workspace: ${workspaceId}   recipient: ${recipient}   window: ${window.source} [${window.start}, ${window.end})   count: ${rows.length}`,
  );
  console.log(toTable(rows));
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
