import { NotImplementedError } from "@nominate/observability";

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

export function createSlackClient(_botToken: string): SlackClient {
  throw new NotImplementedError("createSlackClient");
}
