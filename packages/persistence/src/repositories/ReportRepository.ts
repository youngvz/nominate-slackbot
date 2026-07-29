import { NotImplementedError } from "@nominate/observability";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ReportExecutionItem, WinnerDmDelivery } from "@nominate/domain";

export interface ReportRepository {
  getExecution(input: { workspaceId: string; periodStart: string }): Promise<ReportExecutionItem | null>;
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
  _client: DynamoDBDocumentClient,
  _tableName: string,
): ReportRepository {
  throw new NotImplementedError("createReportRepository");
}
