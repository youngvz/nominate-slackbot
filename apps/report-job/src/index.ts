import { loadEnv } from "@nominate/configuration";
import type { BiweeklyReportRequestedV1 } from "@nominate/contracts";
import { createLogger, type Logger } from "@nominate/observability";
import {
  createDynamoClient,
  createNominationRepository,
  createReportRepository,
  DEFAULT_GSI1_NAME,
} from "@nominate/persistence";
import { createSlackClient } from "@nominate/slack";
import type { Handler } from "aws-lambda";
import { runReport, type RunReportDeps } from "./runReport.js";

// docs/10 §Biweekly report. EventBridge Scheduler invokes this Lambda every
// other Friday at 12:00 PM America/New_York. First execution 2026-08-14.
// docs/02 §Publication rules: DM failures never abort or roll back the public
// publication — they're recorded on the execution row for future retries.

interface HandlerDeps extends RunReportDeps {
  logger: Logger;
}

let cachedDeps: HandlerDeps | undefined;

async function getDeps(): Promise<HandlerDeps> {
  if (cachedDeps) return cachedDeps;
  const env = loadEnv();
  const botToken = env.SLACK_BOT_TOKEN;
  if (!botToken) {
    throw new Error("SLACK_BOT_TOKEN must be resolved before handling reports");
  }
  const logger = createLogger({
    service: env.SERVICE_NAME,
    environment: env.NODE_ENV,
  });
  const dynamo = createDynamoClient({
    region: env.AWS_REGION,
    tableName: env.DYNAMODB_TABLE_NAME,
  });
  cachedDeps = {
    logger,
    nominations: createNominationRepository(
      dynamo,
      env.DYNAMODB_TABLE_NAME,
      DEFAULT_GSI1_NAME,
    ),
    reports: createReportRepository(dynamo, env.DYNAMODB_TABLE_NAME),
    slack: createSlackClient(botToken),
    recognitionChannelId: env.SLACK_RECOGNITION_CHANNEL_ID,
    now: () => Date.now(),
  };
  return cachedDeps;
}

export const handler: Handler<BiweeklyReportRequestedV1, void> = async (event) => {
  const deps = await getDeps();
  await runReport(event, deps);
};
