#!/usr/bin/env node
// List Slack workspace users via users.list. Pulls the bot token from AWS
// Secrets Manager using the ARN the deployed Lambdas already reference — no
// hard-coded ARNs or plaintext tokens.
//
// Enterprise Grid installs (sandbox included) require a team_id argument on
// users.list; without it the API returns `missing_argument`. This script
// pulls team_id from the report Lambda's REPORT_WORKSPACE_ID by default and
// accepts --workspace to override.
//
// Usage:
//   pnpm dev:users [--workspace T…] [--all] [--format json|table] [--env dev|production]

import { LambdaClient, GetFunctionConfigurationCommand } from "@aws-sdk/client-lambda";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const PAGE_LIMIT = 200;

function parseArgs(argv) {
  const out = { env: "dev", all: false, format: "table" };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--workspace":
      case "--env":
      case "--format":
        out[key.slice(2)] = argv[++i];
        break;
      case "--all":
        out.all = true;
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
  pnpm dev:users [--workspace T…] [--all] [--format json|table] [--env dev|production]

Flags:
  --workspace   Slack team_id to list (defaults to the target Lambda's REPORT_WORKSPACE_ID).
  --all         Include bots, deleted users, and Slackbot. Default filters those out.
  --format      table (default) or json.
  --env         dev (default) or production.
`);
}

async function fetchLambdaEnv(functionName, region) {
  const lambda = new LambdaClient({ region });
  const res = await lambda.send(
    new GetFunctionConfigurationCommand({ FunctionName: functionName }),
  );
  const env = res.Environment?.Variables ?? {};
  const required = ["SLACK_BOT_TOKEN_ARN", "REPORT_WORKSPACE_ID"];
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Lambda ${functionName} is missing env vars: ${missing.join(", ")}`,
    );
  }
  return env;
}

async function fetchBotToken(arn, region) {
  const client = new SecretsManagerClient({ region });
  const res = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!res.SecretString) {
    throw new Error(`Secrets Manager returned no SecretString for ${arn}`);
  }
  return res.SecretString;
}

async function usersList(token, teamId) {
  const members = [];
  let cursor;
  for (;;) {
    const params = new URLSearchParams({
      team_id: teamId,
      limit: String(PAGE_LIMIT),
    });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`https://slack.com/api/users.list?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!body.ok) {
      const detail = body.needed ? ` (needed: ${body.needed})` : "";
      throw new Error(`users.list failed: ${body.error}${detail}`);
    }
    members.push(...body.members);
    cursor = body.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  return members;
}

function toTable(rows) {
  if (rows.length === 0) return "(no users)";
  const cols = ["id", "name", "real_name", "is_bot", "deleted", "tz"];
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
  const functionName = `nominate-slackbot-${env}-report`;

  const lambdaEnv = await fetchLambdaEnv(functionName, region);
  const teamId = args.workspace ?? lambdaEnv.REPORT_WORKSPACE_ID;
  const token = await fetchBotToken(lambdaEnv.SLACK_BOT_TOKEN_ARN, region);

  const raw = await usersList(token, teamId);
  const members = args.all
    ? raw
    : raw.filter(
        (m) => !m.is_bot && !m.deleted && m.id !== "USLACKBOT",
      );

  if (args.format === "json") {
    console.log(
      JSON.stringify(
        {
          workspaceId: teamId,
          totalReturned: raw.length,
          shown: members.length,
          members: members.map((m) => ({
            id: m.id,
            name: m.name,
            real_name: m.real_name,
            is_bot: m.is_bot,
            deleted: m.deleted,
            team_id: m.team_id,
            tz: m.tz,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`workspace: ${teamId}   returned: ${raw.length}   shown: ${members.length}`);
  console.log(
    toTable(
      members.map((m) => ({
        id: m.id,
        name: m.name,
        real_name: m.real_name,
        is_bot: m.is_bot,
        deleted: m.deleted,
        tz: m.tz,
      })),
    ),
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
