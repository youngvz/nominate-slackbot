#!/usr/bin/env node
// Invoke the report Lambda directly with a BiweeklyReportRequestedV1 payload.
// By default runs against the most-recently-closed period and sets
// forceRepublish=true so the public message re-posts and winner DMs re-fire
// even if the row is already PUBLISHED. This is the same shape the
// /kudos-admin report path produces (apps/slack-ingress/src/queue/reportInvoker.ts).
//
// Usage:
//   pnpm dev:report [--period-start ISO] [--period-end ISO]
//                   [--no-force] [--sync] [--env dev|production]

import { LambdaClient, InvokeCommand, GetFunctionConfigurationCommand } from "@aws-sdk/client-lambda";

// Duplicated from packages/domain/src/value/ReportingPeriod.ts to avoid a
// build dependency; must stay in sync with the deployed Lambda's env.
const PERIOD_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const out = { env: "dev", force: true, sync: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--period-start":
      case "--period-end":
      case "--env":
        out[key.slice(2)] = argv[++i];
        break;
      case "--no-force":
        out.force = false;
        break;
      case "--sync":
        out.sync = true;
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
  pnpm dev:report [--period-start ISO] [--period-end ISO] [--no-force] [--sync] [--env dev|production]

Flags:
  --period-start   ISO timestamp for the report window start. Pass with --period-end.
  --period-end     ISO timestamp for the report window end.
  --no-force       Omit forceRepublish (default forceRepublish=true).
  --sync           InvocationType=RequestResponse; wait for the Lambda to finish and print its response.
                   Without this, InvocationType=Event (fire-and-forget, matches admin path).
  --env            dev (default) or production.
`);
}

async function fetchLambdaEnv(functionName, region) {
  const lambda = new LambdaClient({ region });
  const res = await lambda.send(
    new GetFunctionConfigurationCommand({ FunctionName: functionName }),
  );
  const env = res.Environment?.Variables ?? {};
  const required = ["REPORT_WORKSPACE_ID", "FIRST_REPORT_AT", "PROGRAM_START_AT"];
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Lambda ${functionName} is missing env vars: ${missing.join(", ")}`,
    );
  }
  return env;
}

// Mirrors mostRecentClosedPeriod() from packages/domain — the report Lambda
// applies the same fallback when periodStart/periodEnd are omitted. Doing it
// here means the caller sees which window will be used before invocation.
function mostRecentClosedPeriod(nowEpochMs, programStartMs, firstReportMs) {
  if (nowEpochMs < firstReportMs) return null;
  const offset = nowEpochMs - firstReportMs;
  const n = Math.floor(offset / PERIOD_LENGTH_MS);
  const boundary = firstReportMs + n * PERIOD_LENGTH_MS;
  const start = n === 0 ? programStartMs : boundary - PERIOD_LENGTH_MS;
  return {
    start: new Date(start).toISOString(),
    end: new Date(boundary).toISOString(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (Boolean(args["period-start"]) !== Boolean(args["period-end"])) {
    throw new Error("Pass both --period-start and --period-end, or neither.");
  }

  const env = args.env ?? "dev";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const functionName = `nominate-slackbot-${env}-report`;

  const lambdaEnv = await fetchLambdaEnv(functionName, region);
  const workspaceId = lambdaEnv.REPORT_WORKSPACE_ID;

  let periodStart = args["period-start"];
  let periodEnd = args["period-end"];
  if (!periodStart && !periodEnd) {
    const programStartMs = Date.parse(lambdaEnv.PROGRAM_START_AT);
    const firstReportMs = Date.parse(lambdaEnv.FIRST_REPORT_AT);
    if (Number.isNaN(programStartMs) || Number.isNaN(firstReportMs)) {
      throw new Error(
        `Cannot parse PROGRAM_START_AT / FIRST_REPORT_AT from Lambda env.`,
      );
    }
    const closed = mostRecentClosedPeriod(Date.now(), programStartMs, firstReportMs);
    if (!closed) {
      throw new Error(
        `No closed period yet — now is before FIRST_REPORT_AT (${lambdaEnv.FIRST_REPORT_AT}). Pass --period-start/--period-end to override.`,
      );
    }
    periodStart = closed.start;
    periodEnd = closed.end;
  }

  const nowIso = new Date().toISOString();
  const event = {
    eventType: "report.biweekly.requested",
    schemaVersion: 1,
    workspaceId,
    scheduledAt: nowIso,
    periodStart,
    periodEnd,
    executionKey: `${workspaceId}#${periodStart}#dev-invoke`,
    ...(args.force ? { forceRepublish: true } : {}),
  };

  const lambda = new LambdaClient({ region });
  const res = await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: args.sync ? "RequestResponse" : "Event",
      LogType: args.sync ? "Tail" : "None",
      Payload: Buffer.from(JSON.stringify(event)),
    }),
  );

  const output = {
    ok: res.StatusCode !== undefined && res.StatusCode < 300,
    env,
    functionName,
    statusCode: res.StatusCode,
    invocationType: args.sync ? "RequestResponse" : "Event",
    event,
  };
  if (args.sync) {
    output.functionError = res.FunctionError ?? null;
    output.payload = res.Payload
      ? Buffer.from(res.Payload).toString("utf8")
      : null;
    output.logTail = res.LogResult
      ? Buffer.from(res.LogResult, "base64").toString("utf8")
      : null;
  }
  console.log(JSON.stringify(output, null, 2));

  if (args.sync && res.FunctionError) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
