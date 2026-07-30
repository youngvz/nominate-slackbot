import {
  NOMINATE_CALLBACK_ID,
  NOMINATE_DESCRIPTION_ACTION_ID,
  NOMINATE_DESCRIPTION_BLOCK_ID,
  NOMINATE_RECIPIENT_ACTION_ID,
  NOMINATE_RECIPIENT_BLOCK_ID,
} from "./nominateModal.js";

// Companion to nominateModal — extracts the two inputs from a Slack
// view_submission payload's `view.state.values` shape. Slack's schema is
// nested Record-of-Record, so we keep the runtime parsing narrow.

export interface ParsedNominateSubmission {
  callbackId: string;
  recipientSlackId: string;
  descriptionRaw: string;
}

export type NominateSubmissionParse =
  | { ok: true; parsed: ParsedNominateSubmission }
  | { ok: false; reason: "WRONG_CALLBACK" | "MISSING_RECIPIENT" | "MISSING_DESCRIPTION" };

interface ViewShape {
  callback_id?: unknown;
  state?: {
    values?: Record<string, Record<string, unknown> | undefined>;
  };
}

export function parseNominateSubmission(view: unknown): NominateSubmissionParse {
  const shape = (view ?? {}) as ViewShape;
  if (shape.callback_id !== NOMINATE_CALLBACK_ID) {
    return { ok: false, reason: "WRONG_CALLBACK" };
  }
  const values = shape.state?.values ?? {};

  const recipientBlock = values[NOMINATE_RECIPIENT_BLOCK_ID];
  const recipientAction = recipientBlock?.[NOMINATE_RECIPIENT_ACTION_ID] as
    | { selected_user?: unknown }
    | undefined;
  const recipientSlackId = recipientAction?.selected_user;
  if (typeof recipientSlackId !== "string" || recipientSlackId.length === 0) {
    return { ok: false, reason: "MISSING_RECIPIENT" };
  }

  const descriptionBlock = values[NOMINATE_DESCRIPTION_BLOCK_ID];
  const descriptionAction = descriptionBlock?.[NOMINATE_DESCRIPTION_ACTION_ID] as
    | { value?: unknown }
    | undefined;
  const descriptionRaw = descriptionAction?.value;
  if (typeof descriptionRaw !== "string") {
    return { ok: false, reason: "MISSING_DESCRIPTION" };
  }

  return {
    ok: true,
    parsed: {
      callbackId: NOMINATE_CALLBACK_ID,
      recipientSlackId,
      descriptionRaw,
    },
  };
}
