import { NotImplementedError } from "@nominate/observability";
import type { Winner } from "@nominate/domain";

// docs/10 §Public message. Winners + counts only. No nominator identities or
// descriptions in the shared channel.
export function buildReportMessage(_input: {
  periodStart: string;
  periodEnd: string;
  winners: readonly Winner[];
}): { text: string; blocks: unknown[] } {
  throw new NotImplementedError("buildReportMessage");
}
