import { loadEnv, resolveSlackSecrets } from "@nominate/configuration";
import type { WeeklyReminderRequestedV1 } from "@nominate/contracts";
import { createLogger, type Logger } from "@nominate/observability";
import {
  createDynamoClient,
  createReminderRepository,
} from "@nominate/persistence";
import { createSlackClient } from "@nominate/slack";
import type { Handler } from "aws-lambda";
import { postReminder, type PostReminderDeps } from "./postReminder.js";

// docs/10 §Weekly reminder. EventBridge Scheduler invokes this Lambda every
// Friday at 9:00 AM America/New_York. First execution 2026-08-07.

interface HandlerDeps extends PostReminderDeps {
  logger: Logger;
}

let cachedDeps: HandlerDeps | undefined;

async function getDeps(): Promise<HandlerDeps> {
  if (cachedDeps) return cachedDeps;
  const env = loadEnv();
  const { botToken } = await resolveSlackSecrets(env);
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
    reminders: createReminderRepository(dynamo, env.DYNAMODB_TABLE_NAME),
    slack: createSlackClient(botToken),
    recognitionChannelId: env.SLACK_RECOGNITION_CHANNEL_ID,
    now: () => Date.now(),
  };
  return cachedDeps;
}

export const handler: Handler<WeeklyReminderRequestedV1, void> = async (event) => {
  const deps = await getDeps();
  await postReminder(event, deps);
};
