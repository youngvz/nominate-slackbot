import type { NominationItem } from "@nominate/domain";
import { keys } from "../keys.js";

// docs/05 §Nomination + §Reporting index. Attribute names use PascalCase for
// GSI1 keys to match the recommended index definition; primary keys use PK/SK.
export function toNominationDdbItem(n: NominationItem): Record<string, unknown> {
  return {
    PK: keys.nominationPK(n.workspaceId),
    SK: keys.nominationSK(n.submittedAtEpochMs, n.nominationId),
    GSI1PK: keys.gsi1Pk(n.workspaceId),
    GSI1SK: keys.gsi1Sk(n.submittedAtEpochMs, n.nominationId),
    entityType: n.entityType,
    workspaceId: n.workspaceId,
    nominationId: n.nominationId,
    nominatorSlackId: n.nominatorSlackId,
    recipientSlackId: n.recipientSlackId,
    description: n.description,
    submittedAt: n.submittedAt,
    submittedAtEpochMs: n.submittedAtEpochMs,
    reportPeriodStart: n.reportPeriodStart,
    reportPeriodEnd: n.reportPeriodEnd,
    ...(n.sourceChannelId ? { sourceChannelId: n.sourceChannelId } : {}),
    sourceType: n.sourceType,
    status: n.status,
    retentionExpiresAt: n.retentionExpiresAt,
  };
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`fromNominationDdbItem: missing string attribute ${key}`);
  }
  return value;
}

function requireNumber(raw: Record<string, unknown>, key: string): number {
  const value = raw[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`fromNominationDdbItem: missing numeric attribute ${key}`);
  }
  return value;
}

export function fromNominationDdbItem(raw: Record<string, unknown>): NominationItem {
  const sourceType = raw.sourceType;
  if (sourceType !== "CHANNEL" && sourceType !== "DM") {
    throw new Error(`fromNominationDdbItem: invalid sourceType ${String(sourceType)}`);
  }
  const status = raw.status;
  if (status !== "ACTIVE") {
    throw new Error(`fromNominationDdbItem: invalid status ${String(status)}`);
  }
  const sourceChannelId =
    typeof raw.sourceChannelId === "string" ? raw.sourceChannelId : undefined;
  return {
    entityType: "NOMINATION",
    workspaceId: requireString(raw, "workspaceId"),
    nominationId: requireString(raw, "nominationId"),
    nominatorSlackId: requireString(raw, "nominatorSlackId"),
    recipientSlackId: requireString(raw, "recipientSlackId"),
    description: requireString(raw, "description"),
    submittedAt: requireString(raw, "submittedAt"),
    submittedAtEpochMs: requireNumber(raw, "submittedAtEpochMs"),
    reportPeriodStart: requireString(raw, "reportPeriodStart"),
    reportPeriodEnd: requireString(raw, "reportPeriodEnd"),
    ...(sourceChannelId ? { sourceChannelId } : {}),
    sourceType,
    status,
    retentionExpiresAt: requireNumber(raw, "retentionExpiresAt"),
  };
}
