import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { NOMINATE_CALLBACK_ID, type SlackClient } from "@nominate/slack";
import { createLogger } from "@nominate/observability";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handleRequest } from "../index.js";

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
  return {
    slackClient,
    openView,
    signingSecret: SECRET,
    logger: createLogger({ service: "test", environment: "test" }),
    now: () => 1_800_000_000,
    ...overrides,
  };
}

describe("slack-ingress handler", () => {
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

  it("acks and defers interactive payload handling in this slice", async () => {
    const deps = makeDeps();
    const body = new URLSearchParams({ payload: '{"type":"view_submission"}' }).toString();
    const timestamp = deps.now();
    const event = buildEvent(body, timestamp, sign(timestamp, body));

    const response = await handleRequest(event, deps);

    expect(response.statusCode).toBe(200);
    expect(deps.openView).not.toHaveBeenCalled();
  });
});
