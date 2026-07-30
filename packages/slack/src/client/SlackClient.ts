import { WebClient, type View } from "@slack/web-api";

export interface PostMessageInput {
  channel: string;
  text: string;
  blocks?: unknown[];
  threadTs?: string;
}

export interface OpenViewInput {
  triggerId: string;
  view: unknown;
}

export interface OpenDmInput {
  userSlackId: string;
}

export interface SlackClient {
  postMessage(input: PostMessageInput): Promise<{ ts: string; channel: string }>;
  openView(input: OpenViewInput): Promise<{ viewId: string }>;
  openDm(input: OpenDmInput): Promise<{ channel: string }>;
  getUser(userSlackId: string): Promise<unknown>;
}

export function createSlackClient(botToken: string): SlackClient {
  const web = new WebClient(botToken);

  return {
    async postMessage({ channel, text, blocks, threadTs }) {
      const res = await web.chat.postMessage({
        channel,
        text,
        ...(blocks ? { blocks: blocks as never } : {}),
        ...(threadTs ? { thread_ts: threadTs } : {}),
      });
      if (!res.ok || !res.ts || !res.channel) {
        throw new Error(`chat.postMessage failed: ${res.error ?? "unknown"}`);
      }
      return { ts: res.ts, channel: res.channel };
    },

    async openView({ triggerId, view }) {
      const res = await web.views.open({ trigger_id: triggerId, view: view as View });
      if (!res.ok || !res.view?.id) {
        throw new Error(`views.open failed: ${res.error ?? "unknown"}`);
      }
      return { viewId: res.view.id };
    },

    async openDm({ userSlackId }) {
      const res = await web.conversations.open({ users: userSlackId });
      if (!res.ok || !res.channel?.id) {
        throw new Error(`conversations.open failed: ${res.error ?? "unknown"}`);
      }
      return { channel: res.channel.id };
    },

    async getUser(userSlackId) {
      const res = await web.users.info({ user: userSlackId });
      if (!res.ok || !res.user) {
        throw new Error(`users.info failed: ${res.error ?? "unknown"}`);
      }
      return res.user;
    },
  };
}
