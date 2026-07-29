import { NotImplementedError } from "@nominate/observability";
import type { EligibilityItem } from "@nominate/domain";

export function toEligibilityDdbItem(_e: EligibilityItem): Record<string, unknown> {
  throw new NotImplementedError("toEligibilityDdbItem");
}

export function fromEligibilityDdbItem(_raw: Record<string, unknown>): EligibilityItem {
  throw new NotImplementedError("fromEligibilityDdbItem");
}
