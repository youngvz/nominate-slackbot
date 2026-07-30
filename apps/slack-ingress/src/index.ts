import { randomUUID } from "node:crypto";
import { loadEnv, resolveBotToken, resolveSigningSecret } from "@nominate/configuration";
import { createLogger, type Logger } from "@nominate/observability";
import {
  createDynamoClient,
  createEligibilityRepository,
  type EligibilityRepository,
} from "@nominate/persistence";
import { createSlackClient, type SlackClient, type SlashCommandPayload } from "@nominate/slack";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { verifyRequest } from "./middleware/verifySignature.js";
import { handleAdminCommand, type AdminReportInvoker } from "./routes/adminReport.js";
import { handleSlashCommand } from "./routes/slashCommand.js";
import { handleViewSubmission, type ViewSubmissionContext } from "./routes/viewSubmission.js";
import {
  createPublisherFromEnv,
  type NominationPublisher,
} from "./queue/publisher.js";
import {
  createLambdaReportInvoker,
  createStubReportInvoker,
} from "./queue/reportInvoker.js";

// Entry point for the API Gateway HTTP API. docs/04 §Slack ingress Lambda:
// preserve the raw body, verify signature, acknowledge within Slack's trigger
// deadline, avoid slow calls on the ack path.

interface Deps {
  slackClient: SlackClient;
  publisher: NominationPublisher;
  reportInvoker: AdminReportInvoker;
  eligibility: EligibilityRepository;
  signingSecret: string;
  maintainerAllowlist: readonly string[];
  logger: Logger;
  // Slack request signatures use unix seconds — see docs/09 §Signature verification.
  now: () => number;
  // Everything else that cares about wall time (eligibility, submittedAt) uses
  // milliseconds. Keeping the two clocks separate avoids accidental mixing.
  nowMs: () => number;
  nowIso: () => string;
}

let cachedDeps: Deps | undefined;

async function getDeps(): Promise<Deps> {
  if (cachedDeps) return cachedDeps;
  const env = loadEnv();
  const [signingSecret, botToken] = await Promise.all([
    resolveSigningSecret(env),
    resolveBotToken(env),
  ]);
  const logger = createLogger({
    service: env.SERVICE_NAME,
    environment: env.NODE_ENV,
  });
  const dynamo = createDynamoClient({
    region: env.AWS_REGION,
    tableName: env.DYNAMODB_TABLE_NAME,
  });
  const reportInvoker = env.REPORT_FUNCTION_NAME
    ? createLambdaReportInvoker({
        functionName: env.REPORT_FUNCTION_NAME,
        region: env.AWS_REGION,
      })
    : createStubReportInvoker(logger);
  cachedDeps = {
    slackClient: createSlackClient(botToken),
    publisher: createPublisherFromEnv({
      queueUrl: env.NOMINATION_QUEUE_URL,
      region: env.AWS_REGION,
      logger,
    }),
    reportInvoker,
    eligibility: createEligibilityRepository(dynamo, env.DYNAMODB_TABLE_NAME),
    signingSecret,
    maintainerAllowlist: env.SLACK_MAINTAINER_IDS,
    logger,
    now: () => Math.floor(Date.now() / 1000),
    nowMs: () => Date.now(),
    nowIso: () => new Date().toISOString(),
  };
  return cachedDeps;
}

export async function handleRequest(
  event: APIGatewayProxyEventV2,
  deps: Deps,
): Promise<APIGatewayProxyStructuredResultV2> {
  const correlationId = randomUUID();
  const log = deps.logger.child({ correlationId });

  const rawBody = extractRawBody(event);
  const headers = normalizeHeaders(event.headers);

  const verification = verifyRequest({
    rawBody,
    headers,
    signingSecret: deps.signingSecret,
    nowSeconds: deps.now(),
  });
  if (!verification.ok) {
    log.warn("slack_signature_rejected", {
      outcome: "rejected",
      errorCategory: verification.reason,
    });
    return { statusCode: verification.statusCode, body: "" };
  }

  const contentType = headers["content-type"] ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const payloadJson = params.get("payload");
    if (payloadJson) {
      return handleInteractivePayload(payloadJson, correlationId, deps, log);
    }

    const slashCommand = parseSlashCommand(params);
    if (slashCommand) {
      log.info("slash_command_received", {
        eventType: "slash_command",
        workspaceId: slashCommand.teamId,
        command: slashCommand.command,
      });
      if (slashCommand.command === "/nominate-admin") {
        return handleAdminSlashCommand(slashCommand, deps, log);
      }
      try {
        await handleSlashCommand(slashCommand, {
          slackClient: deps.slackClient,
          eligibility: deps.eligibility,
          logger: log,
          nowMs: deps.nowMs,
        });
        log.info("slash_command_handled", {
          eventType: "slash_command",
          outcome: "modal_opened",
          workspaceId: slashCommand.teamId,
        });
      } catch (err) {
        log.error("slash_command_failed", {
          eventType: "slash_command",
          outcome: "error",
          workspaceId: slashCommand.teamId,
          errorCategory: err instanceof Error ? err.name : "unknown",
        });
      }
      return { statusCode: 200, body: "" };
    }
  }

  log.info("slack_request_unhandled", {
    outcome: "not_implemented",
    contentType,
  });
  return { statusCode: 200, body: "" };
}

// docs/03 §Admin surface. `/nominate-admin` responds inline (ephemeral) with
// the outcome text instead of using response_url — the outbound path is
// synchronous with the request and doesn't need a second HTTP hop.
async function handleAdminSlashCommand(
  slashCommand: SlashCommandPayload,
  deps: Deps,
  log: Logger,
): Promise<APIGatewayProxyStructuredResultV2> {
  const result = await handleAdminCommand(slashCommand, {
    invoker: deps.reportInvoker,
    maintainerAllowlist: deps.maintainerAllowlist,
    // response_url path is unused for now — kept in the interface so future
    // long-running admin ops can push follow-up messages after the ack.
    respond: async () => {},
    logger: log,
    now: deps.nowMs,
  });
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      response_type: "ephemeral",
      text: result.ephemeralText,
    }),
  };
}

async function handleInteractivePayload(
  payloadJson: string,
  correlationId: string,
  deps: Deps,
  log: Logger,
): Promise<APIGatewayProxyStructuredResultV2> {
  let payload: InteractivePayload;
  try {
    payload = JSON.parse(payloadJson) as InteractivePayload;
  } catch {
    log.warn("interactive_payload_parse_failed", {
      outcome: "rejected",
      errorCategory: "MALFORMED_JSON",
    });
    return { statusCode: 400, body: "" };
  }

  if (payload.type !== "view_submission") {
    log.info("slack_interaction_ignored", {
      outcome: "not_implemented",
      eventType: payload.type ?? "unknown",
    });
    return { statusCode: 200, body: "" };
  }

  const workspaceId = payload.team?.id ?? payload.user?.team_id ?? "";
  const nominatorSlackId = payload.user?.id ?? "";
  const viewId = payload.view?.id ?? "";
  if (!workspaceId || !nominatorSlackId || !viewId) {
    log.warn("view_submission_context_missing", {
      outcome: "rejected",
      errorCategory: "MALFORMED_PAYLOAD",
    });
    return { statusCode: 400, body: "" };
  }

  const ctx: ViewSubmissionContext = {
    nominatorSlackId,
    workspaceId,
    viewId,
    correlationId,
    submittedAtIso: deps.nowIso(),
  };

  const result = await handleViewSubmission(payload.view, ctx, {
    publisher: deps.publisher,
    eligibility: deps.eligibility,
    logger: deps.logger,
    now: deps.nowMs,
  });

  if (result.kind === "errors") {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ response_action: "errors", errors: result.errors }),
    };
  }
  return { statusCode: 200, body: "" };
}

interface InteractivePayload {
  type?: string;
  team?: { id?: string };
  user?: { id?: string; team_id?: string };
  view?: { id?: string; callback_id?: string; state?: unknown };
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const deps = await getDeps();
  return handleRequest(event, deps);
};

function extractRawBody(event: APIGatewayProxyEventV2): string {
  if (event.body === undefined) return "";
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }
  return event.body;
}

function normalizeHeaders(
  headers: APIGatewayProxyEventV2["headers"],
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (!headers) return out;
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function parseSlashCommand(params: URLSearchParams): SlashCommandPayload | undefined {
  const command = params.get("command");
  const teamId = params.get("team_id");
  const userId = params.get("user_id");
  const triggerId = params.get("trigger_id");
  const responseUrl = params.get("response_url");
  if (!command || !teamId || !userId || !triggerId || !responseUrl) {
    return undefined;
  }
  const channelId = params.get("channel_id") ?? undefined;
  const text = params.get("text") ?? "";
  return {
    type: "slash_command",
    command,
    text,
    teamId,
    userId,
    triggerId,
    responseUrl,
    ...(channelId ? { channelId } : {}),
  };
}

// Exposed for tests.
export const __internal = { extractRawBody, normalizeHeaders, parseSlashCommand };
