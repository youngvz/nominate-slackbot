import { randomUUID } from "node:crypto";
import { loadEnv, resolveBotToken } from "@nominate/configuration";
import {
  decodeEvent,
  UnsupportedSchemaVersionError,
  type NominationSubmissionRequestedV1,
} from "@nominate/contracts";
import { createLogger, type Logger } from "@nominate/observability";
import {
  createDynamoClient,
  createEligibilityRepository,
  createIdempotencyRepository,
  createNominationRepository,
  DEFAULT_GSI1_NAME,
} from "@nominate/persistence";
import { createSlackClient } from "@nominate/slack";
import type { SQSBatchItemFailure, SQSBatchResponse, SQSHandler, SQSRecord } from "aws-lambda";
import { processMessage, type ProcessMessageDeps } from "./processMessage.js";

// docs/04 §Nomination worker Lambda + docs/06 §SQS behavior. Returns
// batchItemFailures for partial batch failure so poison messages don't block
// unrelated submissions.

interface WorkerDeps extends ProcessMessageDeps {
  logger: Logger;
}

let cachedDeps: WorkerDeps | undefined;

async function getDeps(): Promise<WorkerDeps> {
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
    eligibility: createEligibilityRepository(dynamo, env.DYNAMODB_TABLE_NAME),
    idempotency: createIdempotencyRepository(dynamo, env.DYNAMODB_TABLE_NAME),
    slack: createSlackClient(botToken),
    recognitionChannelId: env.SLACK_RECOGNITION_CHANNEL_ID,
    now: () => Date.now(),
    newNominationId: () => randomUUID(),
  };
  return cachedDeps;
}

export async function handleBatch(
  records: SQSRecord[],
  deps: WorkerDeps,
): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of records) {
    const outcome = await handleOneRecord(record, deps);
    if (outcome === "RETRY") {
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

type RecordOutcome = "OK" | "DROP" | "RETRY";

async function handleOneRecord(record: SQSRecord, deps: WorkerDeps): Promise<RecordOutcome> {
  let event: NominationSubmissionRequestedV1;
  try {
    const decoded = decodeEvent(record.body);
    if (decoded.eventType !== "nomination.submission.requested") {
      deps.logger.warn("worker_unexpected_event", {
        outcome: "dropped",
        eventType: decoded.eventType,
      });
      return "DROP";
    }
    event = decoded;
  } catch (err) {
    if (err instanceof UnsupportedSchemaVersionError) {
      deps.logger.warn("worker_unsupported_schema", {
        outcome: "dropped",
        errorCategory: "UNSUPPORTED_SCHEMA_VERSION",
      });
      return "DROP";
    }
    deps.logger.warn("worker_malformed_message", {
      outcome: "dropped",
      errorCategory: "MALFORMED_JSON",
    });
    return "DROP";
  }

  try {
    await processMessage(event, deps);
    return "OK";
  } catch (err) {
    deps.logger.error("worker_process_failed", {
      correlationId: event.correlationId,
      workspaceId: event.workspaceId,
      outcome: "retry",
      errorCategory: err instanceof Error ? err.name : "unknown",
    });
    return "RETRY";
  }
}

export const handler: SQSHandler = async (event) => {
  const deps = await getDeps();
  return handleBatch(event.Records, deps);
};
