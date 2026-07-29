import { NotImplementedError } from "@nominate/observability";
import type { NominationSubmissionRequestedV1 } from "@nominate/contracts";
import type { NominationResult } from "@nominate/domain";

// docs/04 §Nomination worker Lambda: deserialize, validate, resolve recipient,
// apply eligibility rules, run TransactWriteItems, send private feedback.
export function processMessage(_event: NominationSubmissionRequestedV1): Promise<NominationResult> {
  throw new NotImplementedError("processMessage");
}
