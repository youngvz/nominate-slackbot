#!/usr/bin/env node
// Delete a PAIR_ELIGIBILITY row so the same nominator can immediately
// re-nominate the same recipient. Dev-only, destructive; refuses to run
// against production. Does NOT touch NOMINATION rows — the historical record
// stays intact.
//
// Usage:
//   pnpm dev:clear-eligibility --nominator U… --recipient U… [--yes]
//   pnpm dev:clear-eligibility --nominator U… --all [--yes]
//     (--all → delete every ELIGIBILITY row anchored on this nominator)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { fetchLambdaEnv } from "./lib/nominations.mjs";
import { projectFor } from "./lib/project.mjs";

function parseArgs(argv) {
  const out = { env: "dev", yes: false, all: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--nominator":
      case "--recipient":
      case "--env":
        out[key.slice(2)] = argv[++i];
        break;
      case "--yes":
        out.yes = true;
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
  return out;
}

function usage() {
  console.log(`Usage:
  pnpm dev:clear-eligibility --nominator <U…> --recipient <U…> [--yes]
  pnpm dev:clear-eligibility --nominator <U…> --all [--yes]

  Deletes PAIR_ELIGIBILITY row(s) so the nominator can re-nominate immediately.
  NOMINATION rows are untouched — the historical count is preserved.

  Refuses to run against --env production.
  Without --yes, prints the plan and exits without deleting.
`);
}

function eligibilityPK(workspaceId, nominatorSlackId) {
  return `ELIGIBILITY#${workspaceId}#${nominatorSlackId}`;
}
function eligibilitySK(recipientSlackId) {
  return `RECIPIENT#${recipientSlackId}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (args.env === "production") {
    throw new Error(
      "Refusing to run against production. This script is dev-only.",
    );
  }
  if (!args.nominator) {
    throw new Error("--nominator is required.");
  }
  if (!args.recipient && !args.all) {
    throw new Error("Pass --recipient <U…> or --all.");
  }
  if (args.recipient && args.all) {
    throw new Error("--recipient and --all are mutually exclusive.");
  }

  const env = args.env ?? "dev";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const functionName = `${projectFor(env)}-${env}-report`;
  const lambdaEnv = await fetchLambdaEnv(functionName, region);
  const tableName = lambdaEnv.DYNAMODB_TABLE_NAME;
  const workspaceId = lambdaEnv.REPORT_WORKSPACE_ID;
  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

  let targets;
  if (args.recipient) {
    targets = [
      { PK: eligibilityPK(workspaceId, args.nominator), SK: eligibilitySK(args.recipient) },
    ];
  } else {
    const res = await dynamo.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": eligibilityPK(workspaceId, args.nominator) },
        ProjectionExpression: "PK, SK, recipientSlackId, nextEligibleAt",
      }),
    );
    targets = (res.Items ?? []).map((i) => ({ PK: i.PK, SK: i.SK, meta: i }));
    if (targets.length === 0) {
      console.log(
        JSON.stringify(
          { env, workspaceId, nominator: args.nominator, deleted: 0, note: "No ELIGIBILITY rows found." },
          null,
          2,
        ),
      );
      return;
    }
  }

  if (!args.yes) {
    console.log(
      JSON.stringify(
        {
          env,
          workspaceId,
          nominator: args.nominator,
          dryRun: true,
          wouldDelete: targets.length,
          targets: targets.map((t) => ({
            PK: t.PK,
            SK: t.SK,
            ...(t.meta
              ? {
                  recipient: t.meta.recipientSlackId,
                  nextEligibleAt: t.meta.nextEligibleAt,
                }
              : {}),
          })),
          note: "Re-run with --yes to actually delete.",
        },
        null,
        2,
      ),
    );
    return;
  }

  let deleted = 0;
  for (const t of targets) {
    await dynamo.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK: t.PK, SK: t.SK },
      }),
    );
    deleted++;
  }
  console.log(
    JSON.stringify(
      {
        env,
        workspaceId,
        nominator: args.nominator,
        deleted,
        note: "PAIR_ELIGIBILITY rows removed. The next nomination for these pairs will not be blocked by the repeat window.",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
