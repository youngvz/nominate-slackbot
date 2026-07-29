import { NotImplementedError } from "@nominate/observability";
import type { BlockActionsPayload } from "@nominate/slack";

// Stub for future action_id handling.
export function handleBlockActions(_payload: BlockActionsPayload): Promise<void> {
  throw new NotImplementedError("handleBlockActions");
}
