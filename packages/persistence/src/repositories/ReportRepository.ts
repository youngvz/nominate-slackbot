import {
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { ReportExecutionItem, WinnerDmDelivery } from "@nominate/domain";
import { keys } from "../keys.js";
import { fromReportDdbItem, toReportDdbItem } from "../mappers/report.js";

// docs/05 §Report execution + docs/10 §Idempotency state. The report execution
// row is the sole source of truth for "did we publish yet" and per-winner DM
// delivery state.
export interface ReportRepository {
  getExecution(input: {
    workspaceId: string;
    periodStart: string;
  }): Promise<ReportExecutionItem | null>;
  putPendingExecution(item: ReportExecutionItem): Promise<void>;
  markPublished(input: {
    workspaceId: string;
    periodStart: string;
    publicMessageTs: string;
    publishedAt: string;
  }): Promise<void>;
  updateDmDelivery(input: {
    workspaceId: string;
    periodStart: string;
    delivery: WinnerDmDelivery;
  }): Promise<void>;
}

export function createReportRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): ReportRepository {
  return {
    async getExecution({ workspaceId, periodStart }) {
      const res = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: keys.reportPK(workspaceId),
            SK: keys.reportSK(periodStart),
          },
        }),
      );
      if (!res.Item) return null;
      return fromReportDdbItem(res.Item as Record<string, unknown>);
    },

    async putPendingExecution(item) {
      // Conditional put: only create the PENDING row on the first invocation.
      // A resumed handler must reuse the existing row so it does not overwrite
      // publicMessageTs / dmDeliveries state.
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: toReportDdbItem(item),
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
    },

    async markPublished({ workspaceId, periodStart, publicMessageTs, publishedAt }) {
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: {
            PK: keys.reportPK(workspaceId),
            SK: keys.reportSK(periodStart),
          },
          UpdateExpression:
            "SET #status = :published, publicMessageTs = :ts, publishedAt = :at",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":published": "PUBLISHED",
            ":ts": publicMessageTs,
            ":at": publishedAt,
          },
        }),
      );
    },

    async updateDmDelivery({ workspaceId, periodStart, delivery }) {
      // Replace the matching delivery entry by scanning the persisted list.
      // Volume is bounded by the number of winners (typically 1, occasionally
      // a handful of ties), so we accept a read-modify-write here instead of
      // maintaining a keyed map. Concurrency risk is low: each report
      // execution is driven by a single Lambda invocation.
      const existing = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: keys.reportPK(workspaceId),
            SK: keys.reportSK(periodStart),
          },
          ProjectionExpression: "dmDeliveries",
        }),
      );
      const current = Array.isArray(existing.Item?.dmDeliveries)
        ? (existing.Item!.dmDeliveries as WinnerDmDelivery[])
        : [];
      let replaced = false;
      const next = current.map((entry) => {
        if (entry.recipientSlackId === delivery.recipientSlackId) {
          replaced = true;
          return delivery;
        }
        return entry;
      });
      if (!replaced) next.push(delivery);

      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: {
            PK: keys.reportPK(workspaceId),
            SK: keys.reportSK(periodStart),
          },
          UpdateExpression: "SET dmDeliveries = :d",
          ExpressionAttributeValues: {
            ":d": next.map((entry) => ({
              recipientSlackId: entry.recipientSlackId,
              status: entry.status,
              attempts: entry.attempts,
              ...(entry.lastAttemptAt ? { lastAttemptAt: entry.lastAttemptAt } : {}),
              ...(entry.lastError ? { lastError: entry.lastError } : {}),
            })),
          },
        }),
      );
    },
  };
}
