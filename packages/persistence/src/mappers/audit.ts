import { NotImplementedError } from "@nominate/observability";
import type { AuditEventItem } from "@nominate/domain";

export function toAuditDdbItem(_e: AuditEventItem): Record<string, unknown> {
  throw new NotImplementedError("toAuditDdbItem");
}

export function fromAuditDdbItem(_raw: Record<string, unknown>): AuditEventItem {
  throw new NotImplementedError("fromAuditDdbItem");
}
