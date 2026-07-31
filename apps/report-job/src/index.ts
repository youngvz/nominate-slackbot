import { loadEnv, resolveBotToken } from "@nominate/configuration";
import { createLogger, type Logger } from "@nominate/observability";
import {
  createDynamoClient,
  createNominationRepository,
  createReportRepository,
  DEFAULT_GSI1_NAME,
} from "@nominate/persistence";
import { createSlackClient } from "@nominate/slack";
import type { Handler } from "aws-lambda";
import {
  resolveReportEvent,
  UnresolvableReportEventError,
} from "./resolveReportEvent.js";
import { runReport, type RunReportDeps } from "./runReport.js";

// docs/10 §Biweekly report. EventBridge Scheduler invokes this Lambda every
// other Friday at 12:00 PM America/New_York. First execution 2026-08-14.
// docs/02 §Publication rules: DM failures never abort or roll back the public
// publication — they're recorded on the execution row for future retries.
//
// Two invocation paths land here:
//   1. Scheduled (EventBridge) — payload is `{}`; resolveReportEvent fills in
//      workspace + just-closed period from env + wall clock.
//   2. Admin on-demand (/nominate-admin report) — payload is a full envelope
//      with forceRepublish=true; resolveReportEvent passes it through as-is.

interface HandlerDeps extends RunReportDeps {
  logger: Logger;
  defaultWorkspaceId: string | undefined;
}

let cachedDeps: HandlerDeps | undefined;

async function getDeps(): Promise<HandlerDeps> {
  if (cachedDeps) return cachedDeps;
  const env = loadEnv();
  const botToken = await resolveBotToken(env);
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
    defaultWorkspaceId: env.REPORT_WORKSPACE_ID,
    now: () => Date.now(),
  };
  return cachedDeps;
}

export const handler: Handler<unknown, void> = async (rawEvent) => {
  const deps = await getDeps();
  try {
    const event = resolveReportEvent(rawEvent, {
      now: deps.now,
      defaultWorkspaceId: deps.defaultWorkspaceId,
    });
    await runReport(event, deps);
  } catch (err) {
    if (err instanceof UnresolvableReportEventError) {
      deps.logger.error("report_event_unresolvable", {
        outcome: "error",
        errorCategory: err.code,
        errorMessage: err.message,
      });
    }
    throw err;
  }
};
