// docs/03-slack-app-design.md §Modal. `users_select` for recipient, multiline
// plain-text description constrained 10-1000 chars.
export const NOMINATE_CALLBACK_ID = "nominate_submit";
export const NOMINATE_RECIPIENT_BLOCK_ID = "recipient";
export const NOMINATE_RECIPIENT_ACTION_ID = "recipient_select";
export const NOMINATE_DESCRIPTION_BLOCK_ID = "description";
export const NOMINATE_DESCRIPTION_ACTION_ID = "description_input";

export const NOMINATE_DESCRIPTION_MIN_LENGTH = 10;
export const NOMINATE_DESCRIPTION_MAX_LENGTH = 1000;

export interface NominateModalView {
  type: "modal";
  callback_id: string;
  title: { type: "plain_text"; text: string };
  submit: { type: "plain_text"; text: string };
  close: { type: "plain_text"; text: string };
  blocks: unknown[];
}

// Passed in when opening the modal to remind the nominator who they've
// already recognized this cycle. Slack's user picker can't filter options,
// so a context block above the picker is the least-intrusive signal.
export interface AlreadyRecognized {
  recipientSlackId: string;
  eligibleAgainDateLabel: string;
}

export interface BuildNominateModalOptions {
  alreadyRecognized?: readonly AlreadyRecognized[];
}

export function buildNominateModalView(
  opts: BuildNominateModalOptions = {},
): NominateModalView {
  const hintBlock = renderAlreadyRecognizedHint(opts.alreadyRecognized ?? []);
  const blocks: unknown[] = [];
  if (hintBlock) blocks.push(hintBlock);
  blocks.push(
    {
      type: "input",
      block_id: NOMINATE_RECIPIENT_BLOCK_ID,
      label: { type: "plain_text", text: "Who are you recognizing?" },
      element: {
        type: "users_select",
        action_id: NOMINATE_RECIPIENT_ACTION_ID,
        placeholder: { type: "plain_text", text: "Select a coworker" },
      },
    },
    {
      type: "input",
      block_id: NOMINATE_DESCRIPTION_BLOCK_ID,
      label: { type: "plain_text", text: "Why are you nominating them?" },
      element: {
        type: "plain_text_input",
        action_id: NOMINATE_DESCRIPTION_ACTION_ID,
        multiline: true,
        min_length: NOMINATE_DESCRIPTION_MIN_LENGTH,
        max_length: NOMINATE_DESCRIPTION_MAX_LENGTH,
        placeholder: {
          type: "plain_text",
          text: "Describe what they did and why it mattered.",
        },
      },
    },
  );
  return {
    type: "modal",
    callback_id: NOMINATE_CALLBACK_ID,
    title: { type: "plain_text", text: "Nominate a coworker" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks,
  };
}

function renderAlreadyRecognizedHint(
  items: readonly AlreadyRecognized[],
): unknown | undefined {
  if (items.length === 0) return undefined;
  const parts = items
    .map((it) => `<@${it.recipientSlackId}> (until ${it.eligibleAgainDateLabel})`)
    .join(", ");
  return {
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `You've already recognized ${parts} this cycle.`,
      },
    ],
  };
}
