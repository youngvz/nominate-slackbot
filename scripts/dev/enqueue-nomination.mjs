#!/usr/bin/env node
// Enqueue a NominationSubmissionRequestedV1 onto the dev nomination SQS queue.
// The nomination-worker Lambda picks it up, runs the normal
// eligibility/transact/idempotency pipeline, writes to DynamoDB, and DMs the
// NOMINATOR a confirmation. To exercise the winner-DM path, follow up with
// `dev:report` — that Lambda DMs the RECIPIENT.
//
// Usage:
//   pnpm dev:nominate --nominator U0BLQNZCN22 [--recipient U0BMM35KL72] \
//                     [--description "text"] [--env dev|production]

import { randomUUID } from "node:crypto";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { LambdaClient, GetFunctionConfigurationCommand } from "@aws-sdk/client-lambda";

const DEFAULT_DESCRIPTION =
  "Test nomination submitted via scripts/dev/enqueue-nomination.mjs.";

function parseArgs(argv) {
  const out = { env: "dev" };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--nominator":
      case "--recipient":
      case "--description":
      case "--env":
        out[key.slice(2)] = argv[++i];
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
  pnpm dev:nominate --nominator <U…> [--recipient <U…>] [--description "text"] [--env dev|production]

Defaults:
  --recipient   first ID in the target Lambda's SLACK_MAINTAINER_IDS
  --description "${DEFAULT_DESCRIPTION}"
  --env         dev
`);
}

async function fetchLambdaEnv(functionName, region) {
  const lambda = new LambdaClient({ region });
  const res = await lambda.send(
    new GetFunctionConfigurationCommand({ FunctionName: functionName }),
  );
  const env = res.Environment?.Variables ?? {};
  const required = [
    "NOMINATION_QUEUE_URL",
    "REPORT_WORKSPACE_ID",
    "SLACK_RECOGNITION_CHANNEL_ID",
    "SLACK_MAINTAINER_IDS",
  ];
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Lambda ${functionName} is missing env vars: ${missing.join(", ")}`,
    );
  }
  return env;
}

function firstMaintainerId(csv) {
  const first = csv.split(",").map((s) => s.trim()).find((s) => s.length > 0);
  if (!first) {
    throw new Error("SLACK_MAINTAINER_IDS is set but has no non-empty entries.");
  }
  return first;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.nominator) {
    usage();
    throw new Error("--nominator is required");
  }
  const description = args.description ?? DEFAULT_DESCRIPTION;
  const env = args.env ?? "dev";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const workerName = `nominate-slackbot-${env}-nomination-worker`;

  const lambdaEnv = await fetchLambdaEnv(workerName, region);
  const queueUrl = lambdaEnv.NOMINATION_QUEUE_URL;
  const workspaceId = lambdaEnv.REPORT_WORKSPACE_ID;
  const recipient = args.recipient ?? firstMaintainerId(lambdaEnv.SLACK_MAINTAINER_IDS);

  if (args.nominator === recipient) {
    throw new Error(
      `Nominator and recipient are the same (${recipient}); the worker will reject this as REJECTED_SELF_NOMINATION.`,
    );
  }

  const correlationId = randomUUID();
  const idempotencyKey = randomUUID();
  const submittedAt = new Date().toISOString();
  const event = {
    eventType: "nomination.submission.requested",
    schemaVersion: 1,
    correlationId,
    idempotencyKey,
    workspaceId,
    nominatorSlackId: args.nominator,
    recipientSlackId: recipient,
    description,
    sourceType: "CHANNEL",
    responseContext: { submittedAt },
  };

  const sqs = new SQSClient({ region });
  const res = await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(event),
      MessageAttributes: {
        eventType: { DataType: "String", StringValue: event.eventType },
        schemaVersion: { DataType: "String", StringValue: String(event.schemaVersion) },
        correlationId: { DataType: "String", StringValue: correlationId },
      },
    }),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        env,
        queueUrl,
        workspaceId,
        nominator: args.nominator,
        recipient,
        correlationId,
        idempotencyKey,
        sqsMessageId: res.MessageId,
        note: "Watch CloudWatch logs for `nominate-slackbot-<env>-nomination-worker`; nominator receives DM.",
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
