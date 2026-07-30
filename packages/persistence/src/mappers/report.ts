import type {
  DmDeliveryStatus,
  ReportExecutionItem,
  ReportStatus,
  WinnerDmDelivery,
} from "@nominate/domain";
import { keys } from "../keys.js";

const REPORT_STATUSES: readonly ReportStatus[] = [
  "PENDING",
  "PUBLISHED",
  "PARTIAL_DM_FAILURE",
  "COMPLETED",
  "FAILED",
];

const DM_STATUSES: readonly DmDeliveryStatus[] = [
  "PENDING",
  "SENT",
  "FAILED_RETRYABLE",
  "FAILED_TERMINAL",
];

// docs/05 §Report execution. Winner Slack IDs, counts, delivery state, and the
// public message ts are all persisted so a resumed handler can behave
// idempotently.
export function toReportDdbItem(r: ReportExecutionItem): Record<string, unknown> {
  return {
    PK: keys.reportPK(r.workspaceId),
    SK: keys.reportSK(r.periodStart),
    entityType: r.entityType,
    workspaceId: r.workspaceId,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    status: r.status,
    winnerSlackIds: r.winnerSlackIds,
    countsBySlackId: r.countsBySlackId,
    ...(r.publicMessageTs ? { publicMessageTs: r.publicMessageTs } : {}),
    ...(r.publishedAt ? { publishedAt: r.publishedAt } : {}),
    dmDeliveries: r.dmDeliveries.map(toDmDeliveryDdb),
    retentionPolicy: r.retentionPolicy,
  };
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`fromReportDdbItem: missing string attribute ${key}`);
  }
  return value;
}

function requireStatus(raw: Record<string, unknown>): ReportStatus {
  const value = raw.status;
  if (typeof value !== "string" || !REPORT_STATUSES.includes(value as ReportStatus)) {
    throw new Error(`fromReportDdbItem: invalid status ${String(value)}`);
  }
  return value as ReportStatus;
}

function requireStringArray(raw: Record<string, unknown>, key: string): string[] {
  const value = raw[key];
  if (!Array.isArray(value)) {
    throw new Error(`fromReportDdbItem: missing array attribute ${key}`);
  }
  return value.map((entry, i) => {
    if (typeof entry !== "string") {
      throw new Error(`fromReportDdbItem: ${key}[${i}] is not a string`);
    }
    return entry;
  });
}

function requireCounts(raw: Record<string, unknown>): Record<string, number> {
  const value = raw.countsBySlackId;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("fromReportDdbItem: missing object countsBySlackId");
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`fromReportDdbItem: countsBySlackId[${k}] is not a number`);
    }
    out[k] = v;
  }
  return out;
}

function toDmDeliveryDdb(d: WinnerDmDelivery): Record<string, unknown> {
  return {
    recipientSlackId: d.recipientSlackId,
    status: d.status,
    attempts: d.attempts,
    ...(d.lastAttemptAt ? { lastAttemptAt: d.lastAttemptAt } : {}),
    ...(d.lastError ? { lastError: d.lastError } : {}),
  };
}

function fromDmDeliveryDdb(raw: unknown, index: number): WinnerDmDelivery {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`fromReportDdbItem: dmDeliveries[${index}] is not an object`);
  }
  const entry = raw as Record<string, unknown>;
  const recipientSlackId = entry.recipientSlackId;
  if (typeof recipientSlackId !== "string" || recipientSlackId.length === 0) {
    throw new Error(
      `fromReportDdbItem: dmDeliveries[${index}].recipientSlackId missing`,
    );
  }
  const status = entry.status;
  if (typeof status !== "string" || !DM_STATUSES.includes(status as DmDeliveryStatus)) {
    throw new Error(
      `fromReportDdbItem: dmDeliveries[${index}] invalid status ${String(status)}`,
    );
  }
  const attempts = entry.attempts;
  if (typeof attempts !== "number" || !Number.isFinite(attempts)) {
    throw new Error(`fromReportDdbItem: dmDeliveries[${index}].attempts missing`);
  }
  const lastAttemptAt =
    typeof entry.lastAttemptAt === "string" ? entry.lastAttemptAt : undefined;
  const lastError = typeof entry.lastError === "string" ? entry.lastError : undefined;
  return {
    recipientSlackId,
    status: status as DmDeliveryStatus,
    attempts,
    ...(lastAttemptAt ? { lastAttemptAt } : {}),
    ...(lastError ? { lastError } : {}),
  };
}

export function fromReportDdbItem(raw: Record<string, unknown>): ReportExecutionItem {
  if (raw.entityType !== "REPORT_EXECUTION") {
    throw new Error(
      `fromReportDdbItem: invalid entityType ${String(raw.entityType)}`,
    );
  }
  const rawDmDeliveries = raw.dmDeliveries;
  if (!Array.isArray(rawDmDeliveries)) {
    throw new Error("fromReportDdbItem: missing dmDeliveries array");
  }
  if (raw.retentionPolicy !== "PUBLISHED_METADATA_INDEFINITE") {
    throw new Error(
      `fromReportDdbItem: invalid retentionPolicy ${String(raw.retentionPolicy)}`,
    );
  }
  const publicMessageTs =
    typeof raw.publicMessageTs === "string" ? raw.publicMessageTs : undefined;
  const publishedAt = typeof raw.publishedAt === "string" ? raw.publishedAt : undefined;
  return {
    entityType: "REPORT_EXECUTION",
    workspaceId: requireString(raw, "workspaceId"),
    periodStart: requireString(raw, "periodStart"),
    periodEnd: requireString(raw, "periodEnd"),
    status: requireStatus(raw),
    winnerSlackIds: requireStringArray(raw, "winnerSlackIds"),
    countsBySlackId: requireCounts(raw),
    ...(publicMessageTs ? { publicMessageTs } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    dmDeliveries: rawDmDeliveries.map(fromDmDeliveryDdb),
    retentionPolicy: "PUBLISHED_METADATA_INDEFINITE",
  };
}
