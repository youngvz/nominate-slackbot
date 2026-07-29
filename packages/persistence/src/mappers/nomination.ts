import { NotImplementedError } from "@nominate/observability";
import type { NominationItem } from "@nominate/domain";

export function toNominationDdbItem(_n: NominationItem): Record<string, unknown> {
  throw new NotImplementedError("toNominationDdbItem");
}

export function fromNominationDdbItem(_raw: Record<string, unknown>): NominationItem {
  throw new NotImplementedError("fromNominationDdbItem");
}
