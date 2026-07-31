#!/usr/bin/env node
// Nuclear demo reset: delete every NOMINATION row in a window, every
// PAIR_ELIGIBILITY row anchored on any nominator involved in those
// nominations, and the REPORT_EXECUTION row for the same period. Leaves you
// with a clean period so you can re-run the full flow from scratch.
//
// Dev-only, destructive. Refuses production. Two-phase — prints plan without
// --yes, deletes only with --yes.
//
// Usage:
//   pnpm dev:reset-period                                # current open period
//   pnpm dev:reset-period --closed                       # most-recently-closed
//   pnpm dev:reset-period --period-start ISO --period-end ISO
//   pnpm dev:reset-period --closed --yes                 # execute

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  fetchLambdaEnv,
  resolveWindow,
  createDynamoClient,
  queryNominationsInWindow,
} from "./lib/nominations.mjs";
import { projectFor } from "./lib/project.mjs";

const PERIOD_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const out = { env: "dev", yes: false, closed: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--period-start":
      case "--period-end":
      case "--env":
        out[key.slice(2)] = argv[++i];
        break;
      case "--closed":
        out.closed = true;
        break;
      case "--yes":
        out.yes = true;
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
  pnpm dev:reset-period [--closed | --period-start ISO --period-end ISO] [--yes] [--env dev]

  Deletes NOMINATION rows in the window, associated PAIR_ELIGIBILITY rows, and
  the REPORT_EXECUTION row for the period. Without --yes prints the plan only.

  Refuses --env production.
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

function eligibilityPK(workspaceId, nominatorSlackId) {
  return `ELIGIBILITY#${workspaceId}#${nominatorSlackId}`;
}
function reportPK(workspaceId) {
  return `WORKSPACE#${workspaceId}`;
}
function reportSK(periodStart) {
  return `REPORT#${periodStart}`;
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
  const env = args.env ?? "dev";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const functionName = `${projectFor(env)}-${env}-report`;
  const lambdaEnv = await fetchLambdaEnv(functionName, region);
  const tableName = lambdaEnv.DYNAMODB_TABLE_NAME;
  const workspaceId = lambdaEnv.REPORT_WORKSPACE_ID;

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
    tableName,
    workspaceId,
    startEpochMs: window.startEpochMs,
    endEpochMs: window.endEpochMs,
  });

  // Collect eligibility rows tied to any nominator in this window. We snapshot
  // the pairs first so the dry-run and the write pass line up exactly.
  const nominatorIds = new Set(nominations.map((n) => n.nominatorSlackId));
  const eligibilityRows = [];
  for (const nominator of nominatorIds) {
    const res = await dynamo.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": eligibilityPK(workspaceId, nominator) },
        ProjectionExpression: "PK, SK, recipientSlackId, nextEligibleAt",
      }),
    );
    for (const item of res.Items ?? []) eligibilityRows.push(item);
  }

  // Report execution row is keyed on periodStart. Only makes sense to include
  // when the window matches a known reporting period boundary; we probe on the
  // computed start and let the caller see the result in the plan.
  const reportKey = {
    PK: reportPK(workspaceId),
    SK: reportSK(window.start),
  };
  const reportProbe = await dynamo.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: { ":pk": reportKey.PK, ":sk": reportKey.SK },
    }),
  );
  const reportExists = (reportProbe.Items ?? []).length > 0;

  const plan = {
    env,
    workspaceId,
    window: { source: window.source, start: window.start, end: window.end },
    nominationsToDelete: nominations.length,
    eligibilityToDelete: eligibilityRows.length,
    reportExecutionToDelete: reportExists ? 1 : 0,
    reportExecutionKey: reportKey,
  };

  if (!args.yes) {
    console.log(
      JSON.stringify(
        { ...plan, dryRun: true, note: "Re-run with --yes to actually delete." },
        null,
        2,
      ),
    );
    return;
  }

  let deletedNominations = 0;
  for (const n of nominations) {
    await dynamo.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK: n.PK, SK: n.SK },
      }),
    );
    deletedNominations++;
  }
  let deletedEligibility = 0;
  for (const e of eligibilityRows) {
    await dynamo.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { PK: e.PK, SK: e.SK },
      }),
    );
    deletedEligibility++;
  }
  let deletedReport = 0;
  if (reportExists) {
    await dynamo.send(
      new DeleteCommand({ TableName: tableName, Key: reportKey }),
    );
    deletedReport = 1;
  }

  console.log(
    JSON.stringify(
      {
        ...plan,
        dryRun: false,
        deletedNominations,
        deletedEligibility,
        deletedReport,
        note: "Period reset complete. Re-run pnpm dev:nominate to seed a fresh landscape.",
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
