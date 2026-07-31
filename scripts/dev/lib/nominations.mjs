// Shared helpers for dev inspection scripts. Queries the deployed dev
// DynamoDB table via GSI1 — the same index the report Lambda uses
// (packages/persistence/src/repositories/NominationRepository.ts).
//
// We duplicate the GSI1SK builder (`${epochMs}#${nominationId}`) here to keep
// the .mjs scripts free of a workspace build. If the key shape ever changes
// in packages/persistence/src/keys.ts, update this file too.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaClient, GetFunctionConfigurationCommand } from "@aws-sdk/client-lambda";

const PERIOD_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

export function gsi1Pk(workspaceId) {
  return `WORKSPACE#${workspaceId}#NOMINATIONS`;
}
export function gsi1Sk(epochMs, nominationId) {
  return `${epochMs}#${nominationId}`;
}

export async function fetchLambdaEnv(functionName, region) {
  const lambda = new LambdaClient({ region });
  const res = await lambda.send(
    new GetFunctionConfigurationCommand({ FunctionName: functionName }),
  );
  const env = res.Environment?.Variables ?? {};
  const required = [
    "DYNAMODB_TABLE_NAME",
    "REPORT_WORKSPACE_ID",
    "FIRST_REPORT_AT",
    "PROGRAM_START_AT",
  ];
  const missing = required.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Lambda ${functionName} is missing env vars: ${missing.join(", ")}`,
    );
  }
  return env;
}

// Mirror of packages/domain/src/value/ReportingPeriod.ts periodContaining().
// The "currently open" period is the one that contains `now`.
export function currentOpenPeriod(nowEpochMs, programStartMs, firstReportMs) {
  if (nowEpochMs < firstReportMs) {
    return {
      startEpochMs: programStartMs,
      endEpochMs: firstReportMs,
      start: new Date(programStartMs).toISOString(),
      end: new Date(firstReportMs).toISOString(),
    };
  }
  const offset = nowEpochMs - firstReportMs;
  const n = Math.floor(offset / PERIOD_LENGTH_MS);
  const start = firstReportMs + n * PERIOD_LENGTH_MS;
  const end = start + PERIOD_LENGTH_MS;
  return {
    startEpochMs: start,
    endEpochMs: end,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}

export function resolveWindow(args, lambdaEnv) {
  if (args["period-start"] || args["period-end"]) {
    if (!args["period-start"] || !args["period-end"]) {
      throw new Error("Pass both --period-start and --period-end, or neither.");
    }
    const startEpochMs = Date.parse(args["period-start"]);
    const endEpochMs = Date.parse(args["period-end"]);
    if (!Number.isFinite(startEpochMs) || !Number.isFinite(endEpochMs)) {
      throw new Error("--period-start / --period-end must parse as ISO timestamps.");
    }
    if (endEpochMs <= startEpochMs) {
      throw new Error("--period-end must be after --period-start.");
    }
    return {
      startEpochMs,
      endEpochMs,
      start: new Date(startEpochMs).toISOString(),
      end: new Date(endEpochMs).toISOString(),
      source: "custom",
    };
  }
  const programStartMs = Date.parse(lambdaEnv.PROGRAM_START_AT);
  const firstReportMs = Date.parse(lambdaEnv.FIRST_REPORT_AT);
  const window = currentOpenPeriod(Date.now(), programStartMs, firstReportMs);
  return { ...window, source: "current-open" };
}

export function createDynamoClient(region) {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
}

// Query GSI1 for all nominations in [startEpochMs, endEpochMs). Mirrors
// NominationRepository.queryByPeriod — including the half-open boundary
// treatment (submissions exactly at endEpochMs belong to the next period).
export async function queryNominationsInWindow(client, { tableName, workspaceId, startEpochMs, endEpochMs }) {
  const lower = gsi1Sk(startEpochMs, "");
  const upper = gsi1Sk(endEpochMs, "");
  const items = [];
  let exclusiveStartKey;
  do {
    const res = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK BETWEEN :lo AND :hi",
        ExpressionAttributeValues: {
          ":pk": gsi1Pk(workspaceId),
          ":lo": lower,
          ":hi": upper,
        },
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
      }),
    );
    for (const raw of res.Items ?? []) {
      if (
        raw.entityType === "NOMINATION" &&
        typeof raw.submittedAtEpochMs === "number" &&
        raw.submittedAtEpochMs >= startEpochMs &&
        raw.submittedAtEpochMs < endEpochMs
      ) {
        items.push(raw);
      }
    }
    exclusiveStartKey = res.LastEvaluatedKey;
  } while (exclusiveStartKey);
  items.sort((a, b) => a.submittedAtEpochMs - b.submittedAtEpochMs);
  return items;
}

// Descriptions are treated as PII per docs/09 §Logging. Truncate for terminal
// output by default; the caller may pass showFull=true to opt in.
export function renderDescription(desc, showFull) {
  if (typeof desc !== "string") return "";
  if (showFull) return desc;
  const trimmed = desc.replace(/\s+/g, " ").trim();
  return trimmed.length > 40 ? trimmed.slice(0, 40) + "…" : trimmed;
}
