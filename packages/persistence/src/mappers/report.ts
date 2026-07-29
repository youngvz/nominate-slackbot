import { NotImplementedError } from "@nominate/observability";
import type { ReportExecutionItem } from "@nominate/domain";

export function toReportDdbItem(_r: ReportExecutionItem): Record<string, unknown> {
  throw new NotImplementedError("toReportDdbItem");
}

export function fromReportDdbItem(_raw: Record<string, unknown>): ReportExecutionItem {
  throw new NotImplementedError("fromReportDdbItem");
}
