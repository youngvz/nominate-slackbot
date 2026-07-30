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

// Errors from @slack/web-api carry the Slack payload on `.data`, but only the
// error string bubbles up through generic `Error.message`. SlackApiError keeps
// the endpoint plus scope diagnostics (`needed`, `provided`) so operator logs
// can pinpoint which call and which missing capability triggered a failure —
// docs/09 §Logging permits scope names but not tokens or descriptions.
export interface SlackApiErrorDetails {
  endpoint: string;
  slackError?: string | undefined;
  needed?: string | undefined;
  provided?: string | undefined;
  responseMetadata?: unknown;
  isEnterpriseInstall?: boolean | undefined;
}

export class SlackApiError extends Error {
  readonly endpoint: string;
  readonly slackError?: string | undefined;
  readonly needed?: string | undefined;
  readonly provided?: string | undefined;
  readonly responseMetadata?: unknown;
  readonly isEnterpriseInstall?: boolean | undefined;

  constructor(details: SlackApiErrorDetails, cause?: unknown) {
    const parts = [details.endpoint];
    if (details.slackError) parts.push(details.slackError);
    if (details.needed) parts.push(`needed=${details.needed}`);
    super(`SlackApiError: ${parts.join(" ")}`);
    this.name = "SlackApiError";
    this.endpoint = details.endpoint;
    this.slackError = details.slackError;
    this.needed = details.needed;
    this.provided = details.provided;
    this.responseMetadata = details.responseMetadata;
    this.isEnterpriseInstall = details.isEnterpriseInstall;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

interface SlackErrorLike {
  data?: {
    error?: string;
    needed?: string;
    provided?: string;
    response_metadata?: unknown;
    is_enterprise_install?: boolean;
  };
  message?: string;
}

function rethrowAsSlackError(endpoint: string, err: unknown): never {
  const like = err as SlackErrorLike;
  const details: SlackApiErrorDetails = {
    endpoint,
    slackError: like?.data?.error,
    needed: like?.data?.needed,
    provided: like?.data?.provided,
    responseMetadata: like?.data?.response_metadata,
    isEnterpriseInstall: like?.data?.is_enterprise_install,
  };
  throw new SlackApiError(details, err);
}

function verifyResult(
  endpoint: string,
  res: { ok?: boolean; error?: string },
): void {
  if (res.ok) return;
  throw new SlackApiError({ endpoint, slackError: res.error });
}

// The @slack/web-api v7 argument types don't include team_id even though the
// Slack API accepts and enforces it — cast to reach the underlying request
// builder without losing the rest of the argument surface.
type WithTeamId<T> = T & { team_id: string };

export function createSlackClient(botToken: string): SlackClient {
  const web = new WebClient(botToken);

  return {
    async postMessage({ channel, text, workspaceId, blocks, threadTs }) {
      try {
        const res = await web.chat.postMessage({
          channel,
          text,
          team_id: workspaceId,
          ...(blocks ? { blocks: blocks as never } : {}),
          ...(threadTs ? { thread_ts: threadTs } : {}),
        } as WithTeamId<Parameters<typeof web.chat.postMessage>[0]>);
        verifyResult("chat.postMessage", res);
        if (!res.ts || !res.channel) {
          throw new SlackApiError({
            endpoint: "chat.postMessage",
            slackError: "missing_ts_or_channel",
          });
        }
        return { ts: res.ts, channel: res.channel };
      } catch (err) {
        if (err instanceof SlackApiError) throw err;
        rethrowAsSlackError("chat.postMessage", err);
      }
    },

    async openView({ triggerId, view }) {
      try {
        const res = await web.views.open({ trigger_id: triggerId, view: view as View });
        verifyResult("views.open", res);
        if (!res.view?.id) {
          throw new SlackApiError({
            endpoint: "views.open",
            slackError: "missing_view_id",
          });
        }
        return { viewId: res.view.id };
      } catch (err) {
        if (err instanceof SlackApiError) throw err;
        rethrowAsSlackError("views.open", err);
      }
    },

    async openDm({ userSlackId, workspaceId }) {
      try {
        const res = await web.conversations.open({
          users: userSlackId,
          team_id: workspaceId,
        } as WithTeamId<Parameters<typeof web.conversations.open>[0]>);
        verifyResult("conversations.open", res);
        if (!res.channel?.id) {
          throw new SlackApiError({
            endpoint: "conversations.open",
            slackError: "missing_channel_id",
          });
        }
        return { channel: res.channel.id };
      } catch (err) {
        if (err instanceof SlackApiError) throw err;
        rethrowAsSlackError("conversations.open", err);
      }
    },

    async getUser({ userSlackId, workspaceId }) {
      try {
        const res = await web.users.info({
          user: userSlackId,
          team_id: workspaceId,
        } as WithTeamId<Parameters<typeof web.users.info>[0]>);
        verifyResult("users.info", res);
        if (!res.user) {
          throw new SlackApiError({
            endpoint: "users.info",
            slackError: "missing_user",
          });
        }
        return res.user;
      } catch (err) {
        if (err instanceof SlackApiError) throw err;
        rethrowAsSlackError("users.info", err);
      }
    },
  };
}
