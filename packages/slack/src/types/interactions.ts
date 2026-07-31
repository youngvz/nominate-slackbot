// Transport-layer Slack payload shapes. Keep separate from domain models
// (CLAUDE.md engineering rule 1).

export interface SlashCommandPayload {
  type: "slash_command";
  command: string;
  // Slack's `text` field: everything after the command, verbatim. Used by
  // admin commands to parse subcommands (docs/03 §Admin surface).
  text: string;
  teamId: string;
  userId: string;
  channelId?: string;
  triggerId: string;
  responseUrl: string;
}

export interface ViewSubmissionPayload {
  type: "view_submission";
  teamId: string;
  userId: string;
  view: {
    id: string;
    callbackId: string;
    state: unknown;
    privateMetadata?: string;
  };
}

export interface BlockActionsPayload {
  type: "block_actions";
  teamId: string;
  userId: string;
  actions: Array<{ actionId: string; blockId: string; value?: string }>;
  triggerId?: string;
  responseUrl?: string;
}

export type SlackInteraction = SlashCommandPayload | ViewSubmissionPayload | BlockActionsPayload;
