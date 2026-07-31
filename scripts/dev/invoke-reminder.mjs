#!/usr/bin/env node
// Invoke the reminder Lambda directly with a WeeklyReminderRequestedV1
// payload. Same shape EventBridge Scheduler would send at Friday 9 AM ET —
// useful for previewing the weekly reminder message without waiting.
//
// Usage:
//   pnpm dev:reminder           # async fire-and-forget (matches production path)
//   pnpm dev:reminder --sync    # RequestResponse + tail logs

import { LambdaClient, InvokeCommand, GetFunctionConfigurationCommand } from "@aws-sdk/client-lambda";

function parseArgs(argv) {
  const out = { env: "dev", sync: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--env":
        out[key.slice(2)] = argv[++i];
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
  pnpm dev:reminder [--sync] [--env dev|production]

Flags:
  --sync   InvocationType=RequestResponse; wait for the Lambda and print tail logs.
           Without this, InvocationType=Event (matches EventBridge scheduled path).
  --env    dev (default) or production.
`);
}

async function fetchLambdaEnv(functionName, region) {
  const lambda = new LambdaClient({ region });
  const res = await lambda.send(
    new GetFunctionConfigurationCommand({ FunctionName: functionName }),
  );
  const env = res.Environment?.Variables ?? {};
  if (!env.REPORT_WORKSPACE_ID) {
    throw new Error(
      `Lambda ${functionName} is missing REPORT_WORKSPACE_ID.`,
    );
  }
  return env;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const env = args.env ?? "dev";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const functionName = `nominate-slackbot-${env}-reminder`;
  const lambdaEnv = await fetchLambdaEnv(functionName, region);
  const workspaceId = lambdaEnv.REPORT_WORKSPACE_ID;

  const nowIso = new Date().toISOString();
  const event = {
    eventType: "reminder.weekly.requested",
    schemaVersion: 1,
    workspaceId,
    scheduledAt: nowIso,
    executionKey: `${workspaceId}#${nowIso}#dev-invoke`,
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
    output.payload = res.Payload ? Buffer.from(res.Payload).toString("utf8") : null;
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
