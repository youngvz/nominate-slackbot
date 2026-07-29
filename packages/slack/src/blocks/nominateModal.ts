import { NotImplementedError } from "@nominate/observability";

// docs/03-slack-app-design.md §Modal. `users_select` for recipient, multiline
// plain-text description constrained 10-1000 chars.
export const NOMINATE_CALLBACK_ID = "nominate_submit";
export const NOMINATE_RECIPIENT_BLOCK_ID = "recipient";
export const NOMINATE_RECIPIENT_ACTION_ID = "recipient_select";
export const NOMINATE_DESCRIPTION_BLOCK_ID = "description";
export const NOMINATE_DESCRIPTION_ACTION_ID = "description_input";

export function buildNominateModalView(): unknown {
  throw new NotImplementedError("buildNominateModalView");
}
