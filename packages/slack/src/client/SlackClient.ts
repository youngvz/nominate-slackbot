import { WebClient, type View } from "@slack/web-api";

// Enterprise Grid installs need explicit team_id on every workspace-scoped
// Web API call, or Slack returns missing_scope. Non-Grid callers can pass the
// same workspace id and the parameter is a no-op.
export interface PostMessageInput {
  channel: string;
  text: string;
  workspaceId: string;
  blocks?: unknown[];
  threadTs?: string;
}

export interface OpenViewInput {
  triggerId: string;
  view: unknown;
}

export interface OpenDmInput {
  userSlackId: string;
  workspaceId: string;
}

export interface GetUserInput {
  userSlackId: string;
  workspaceId: string;
}

export interface SlackClient {
  postMessage(input: PostMessageInput): Promise<{ ts: string; channel: string }>;
  openView(input: OpenViewInput): Promise<{ viewId: string }>;
  openDm(input: OpenDmInput): Promise<{ channel: string }>;
  getUser(input: GetUserInput): Promise<unknown>;
}

// The @slack/web-api v7 argument types don't include team_id even though the
// Slack API accepts and enforces it — cast to reach the underlying request
// builder without losing the rest of the argument surface.
type WithTeamId<T> = T & { team_id: string };

export function createSlackClient(botToken: string): SlackClient {
  const web = new WebClient(botToken);

  return {
    async postMessage({ channel, text, workspaceId, blocks, threadTs }) {
      const res = await web.chat.postMessage({
        channel,
        text,
        team_id: workspaceId,
        ...(blocks ? { blocks: blocks as never } : {}),
        ...(threadTs ? { thread_ts: threadTs } : {}),
      } as WithTeamId<Parameters<typeof web.chat.postMessage>[0]>);
      if (!res.ok || !res.ts || !res.channel) {
        throw new Error(`chat.postMessage failed: ${res.error ?? "unknown"}`);
      }
      return { ts: res.ts, channel: res.channel };
    },

    async openView({ triggerId, view }) {
      // views.open is workspace-agnostic — it uses the trigger_id which is
      // already workspace-scoped from the interactive payload.
      const res = await web.views.open({ trigger_id: triggerId, view: view as View });
      if (!res.ok || !res.view?.id) {
        throw new Error(`views.open failed: ${res.error ?? "unknown"}`);
      }
      return { viewId: res.view.id };
    },

    async openDm({ userSlackId, workspaceId }) {
      const res = await web.conversations.open({
        users: userSlackId,
        team_id: workspaceId,
      } as WithTeamId<Parameters<typeof web.conversations.open>[0]>);
      if (!res.ok || !res.channel?.id) {
        throw new Error(`conversations.open failed: ${res.error ?? "unknown"}`);
      }
      return { channel: res.channel.id };
    },

    async getUser({ userSlackId, workspaceId }) {
      const res = await web.users.info({
        user: userSlackId,
        team_id: workspaceId,
      } as WithTeamId<Parameters<typeof web.users.info>[0]>);
      if (!res.ok || !res.user) {
        throw new Error(`users.info failed: ${res.error ?? "unknown"}`);
      }
      return res.user;
    },
  };
}
