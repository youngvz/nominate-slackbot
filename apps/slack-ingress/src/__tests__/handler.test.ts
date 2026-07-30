import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  NOMINATE_CALLBACK_ID,
  NOMINATE_DESCRIPTION_ACTION_ID,
  NOMINATE_DESCRIPTION_BLOCK_ID,
  NOMINATE_RECIPIENT_ACTION_ID,
  NOMINATE_RECIPIENT_BLOCK_ID,
  type SlackClient,
} from "@nominate/slack";
import { createLogger } from "@nominate/observability";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handleRequest } from "../index.js";
import type { NominationPublisher } from "../queue/publisher.js";

const SECRET = "test-signing-secret";

function slashCommandBody(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    token: "verification-token-unused",
    team_id: "T123",
    user_id: "U456",
    channel_id: "C789",
    command: "/nominate",
    text: "",
    trigger_id: "trig-123",
    response_url: "https://hooks.slack.example/response/xyz",
  };
  return new URLSearchParams({ ...defaults, ...overrides }).toString();
}

function viewSubmissionBody(opts: {
  nominatorId?: string;
  recipientId?: string | null;
  description?: string | null;
  teamId?: string;
  viewId?: string;
}): string {
  const {
    nominatorId = "U_NOMINATOR",
    recipientId = "U_RECIPIENT",
    description = "Great work leading the migration.",
    teamId = "T_TEAM",
    viewId = "V_VIEW",
  } = opts;
  const payload = {
    type: "view_submission",
    team: { id: teamId },
    user: { id: nominatorId },
    view: {
      id: viewId,
      callback_id: NOMINATE_CALLBACK_ID,
      state: {
        values: {
          [NOMINATE_RECIPIENT_BLOCK_ID]:
            recipientId === null
              ? {}
              : {
                  [NOMINATE_RECIPIENT_ACTION_ID]: { selected_user: recipientId },
                },
          [NOMINATE_DESCRIPTION_BLOCK_ID]:
            description === null
              ? {}
              : {
                  [NOMINATE_DESCRIPTION_ACTION_ID]: { value: description },
                },
        },
      },
    },
  };
  return new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
}

function sign(timestamp: number, body: string, secret = SECRET): string {
  return `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
}

function buildEvent(body: string, timestamp: number, signature: string): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: "/slack/events",
    rawQueryString: "",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-slack-signature": signature,
      "x-slack-request-timestamp": String(timestamp),
    },
    requestContext: {
      accountId: "0",
      apiId: "x",
      domainName: "example",
      domainPrefix: "x",
      http: {
        method: "POST",
        path: "/slack/events",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "test",
      },
      requestId: "req-1",
      routeKey: "$default",
      stage: "$default",
      time: "01/Jan/2026:00:00:00 +0000",
      timeEpoch: 0,
    },
    body,
    isBase64Encoded: false,
  };
}

function makeDeps(overrides: Partial<Record<string, unknown>> = {}) {
  const openView = vi.fn().mockResolvedValue({ viewId: "V123" });
  const slackClient: SlackClient = {
    openView,
    postMessage: vi.fn(),
    openDm: vi.fn(),
    getUser: vi.fn(),
  };
  const publish = vi.fn().mockResolvedValue({ messageId: "msg-1" });
  const publisher: NominationPublisher = { publish };
  return {
    slackClient,
    openView,
    publisher,
    publish,
    signingSecret: SECRET,
    logger: createLogger({ service: "test", environment: "test" }),
    now: () => 1_800_000_000,
    nowIso: () => "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("slack-ingress handler — slash command", () => {
  it("acks 200 and opens the nominate modal on a valid /nominate slash command", async () => {
    const deps = makeDeps();
    const body = slashCommandBody();
    const timestamp = deps.now();
    const event = buildEvent(body, timestamp, sign(timestamp, body));

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(200);
    expect(deps.openView).toHaveBeenCalledTimes(1);
    const call = deps.openView.mock.calls[0]![0];
    expect(call.triggerId).toBe("trig-123");
    const view = call.view as { type: string; callback_id: string };
    expect(view.type).toBe("modal");
    expect(view.callback_id).toBe(NOMINATE_CALLBACK_ID);
  });

  it("returns 401 when the signature is invalid", async () => {
    const deps = makeDeps();
    const body = slashCommandBody();
    const timestamp = deps.now();
    const event = buildEvent(body, timestamp, "v0=deadbeef");

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(401);
    expect(deps.openView).not.toHaveBeenCalled();
  });

  it("returns 400 when signature headers are missing", async () => {
    const deps = makeDeps();
    const body = slashCommandBody();
    const timestamp = deps.now();
    const event = buildEvent(body, timestamp, sign(timestamp, body));
    delete event.headers["x-slack-signature"];

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(400);
    expect(deps.openView).not.toHaveBeenCalled();
  });
});

describe("slack-ingress handler — view_submission", () => {
  it("publishes NominationSubmissionRequestedV1 and closes the modal on a valid submission", async () => {
    const deps = makeDeps();
    const body = viewSubmissionBody({});
    const timestamp = deps.now();
    const event = buildEvent(body, timestamp, sign(timestamp, body));

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("");
    expect(deps.publish).toHaveBeenCalledTimes(1);
    const publishedEvent = deps.publish.mock.calls[0]![0];
    expect(publishedEvent.eventType).toBe("nomination.submission.requested");
    expect(publishedEvent.schemaVersion).toBe(1);
    expect(publishedEvent.workspaceId).toBe("T_TEAM");
    expect(publishedEvent.nominatorSlackId).toBe("U_NOMINATOR");
    expect(publishedEvent.recipientSlackId).toBe("U_RECIPIENT");
    expect(publishedEvent.description).toBe("Great work leading the migration.");
    expect(publishedEvent.idempotencyKey).toBe("T_TEAM:V_VIEW");
    expect(publishedEvent.responseContext.submittedAt).toBe("2026-08-01T12:00:00.000Z");
  });

  it("rejects a self-nomination with a modal error and does not publish", async () => {
    const deps = makeDeps();
    const body = viewSubmissionBody({
      nominatorId: "U_SAME",
      recipientId: "U_SAME",
    });
    const timestamp = deps.now();
    const event = buildEvent(body, timestamp, sign(timestamp, body));

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.body ?? "{}");
    expect(parsed.response_action).toBe("errors");
    expect(parsed.errors[NOMINATE_RECIPIENT_BLOCK_ID]).toMatch(/yourself/i);
    expect(deps.publish).not.toHaveBeenCalled();
  });

  it("rejects a too-short description with a modal error and does not publish", async () => {
    const deps = makeDeps();
    const body = viewSubmissionBody({ description: "short" });
    const timestamp = deps.now();
    const event = buildEvent(body, timestamp, sign(timestamp, body));

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.body ?? "{}");
    expect(parsed.response_action).toBe("errors");
    expect(parsed.errors[NOMINATE_DESCRIPTION_BLOCK_ID]).toMatch(/short|minimum/i);
    expect(deps.publish).not.toHaveBeenCalled();
  });

  it("rejects a missing recipient with a modal error under the recipient block", async () => {
    const deps = makeDeps();
    const body = viewSubmissionBody({ recipientId: null });
    const timestamp = deps.now();
    const event = buildEvent(body, timestamp, sign(timestamp, body));

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.body ?? "{}");
    expect(parsed.response_action).toBe("errors");
    expect(parsed.errors[NOMINATE_RECIPIENT_BLOCK_ID]).toBeTruthy();
    expect(deps.publish).not.toHaveBeenCalled();
  });

  it("returns 400 when the interactive payload JSON is malformed", async () => {
    const deps = makeDeps();
    const body = new URLSearchParams({ payload: "{not-json" }).toString();
    const timestamp = deps.now();
    const event = buildEvent(body, timestamp, sign(timestamp, body));

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(400);
    expect(deps.publish).not.toHaveBeenCalled();
  });

  it("ignores non-view_submission interactive payloads (e.g. block_actions)", async () => {
    const deps = makeDeps();
    const payload = new URLSearchParams({
      payload: JSON.stringify({ type: "block_actions" }),
    }).toString();
    const timestamp = deps.now();
    const event = buildEvent(payload, timestamp, sign(timestamp, payload));

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(200);
    expect(deps.publish).not.toHaveBeenCalled();
  });
});
