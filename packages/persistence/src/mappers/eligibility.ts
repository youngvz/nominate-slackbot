import type { EligibilityItem } from "@nominate/domain";
import { keys } from "../keys.js";

export function toEligibilityDdbItem(e: EligibilityItem): Record<string, unknown> {
  return {
    PK: keys.eligibilityPK(e.workspaceId, e.nominatorSlackId),
    SK: keys.eligibilitySK(e.recipientSlackId),
    entityType: e.entityType,
    workspaceId: e.workspaceId,
    nominatorSlackId: e.nominatorSlackId,
    recipientSlackId: e.recipientSlackId,
    nominationId: e.nominationId,
    acceptedAt: e.acceptedAt,
    nextEligibleAt: e.nextEligibleAt,
    nextEligibleAtEpoch: e.nextEligibleAtEpoch,
    ttl: e.ttl,
  };
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`fromEligibilityDdbItem: missing string attribute ${key}`);
  }
  return value;
}

function requireNumber(raw: Record<string, unknown>, key: string): number {
  const value = raw[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`fromEligibilityDdbItem: missing numeric attribute ${key}`);
  }
  return value;
}

export function fromEligibilityDdbItem(raw: Record<string, unknown>): EligibilityItem {
  return {
    entityType: "ELIGIBILITY",
    workspaceId: requireString(raw, "workspaceId"),
    nominatorSlackId: requireString(raw, "nominatorSlackId"),
    recipientSlackId: requireString(raw, "recipientSlackId"),
    nominationId: requireString(raw, "nominationId"),
    acceptedAt: requireString(raw, "acceptedAt"),
    nextEligibleAt: requireString(raw, "nextEligibleAt"),
    nextEligibleAtEpoch: requireNumber(raw, "nextEligibleAtEpoch"),
    ttl: requireNumber(raw, "ttl"),
  };
}
