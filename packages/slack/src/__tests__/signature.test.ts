import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { REPLAY_WINDOW_SECONDS, verifySlackSignature } from "../signature/verifier.js";

const SECRET = "test-signing-secret";

function sign(timestamp: number, body: string, secret = SECRET): string {
  const base = `v0:${timestamp}:${body}`;
  return `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
}

describe("verifySlackSignature", () => {
  const body = "token=abc&team_id=T1&command=%2Fnominate";
  const now = 1_800_000_000;

  it("accepts a valid signature within the replay window", () => {
    const result = verifySlackSignature({
      rawBody: body,
      headers: { signature: sign(now, body), timestamp: String(now) },
      signingSecret: SECRET,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: true });
  });

  it("rejects when signature header is missing", () => {
    const result = verifySlackSignature({
      rawBody: body,
      headers: { timestamp: String(now) },
      signingSecret: SECRET,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "MISSING_HEADERS" });
  });

  it("rejects when timestamp header is missing", () => {
    const result = verifySlackSignature({
      rawBody: body,
      headers: { signature: sign(now, body) },
      signingSecret: SECRET,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "MISSING_HEADERS" });
  });

  it("rejects a timestamp too far in the past", () => {
    const stale = now - REPLAY_WINDOW_SECONDS - 1;
    const result = verifySlackSignature({
      rawBody: body,
      headers: { signature: sign(stale, body), timestamp: String(stale) },
      signingSecret: SECRET,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "REPLAY_WINDOW" });
  });

  it("rejects a timestamp too far in the future", () => {
    const future = now + REPLAY_WINDOW_SECONDS + 1;
    const result = verifySlackSignature({
      rawBody: body,
      headers: { signature: sign(future, body), timestamp: String(future) },
      signingSecret: SECRET,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "REPLAY_WINDOW" });
  });

  it("rejects a non-numeric timestamp", () => {
    const result = verifySlackSignature({
      rawBody: body,
      headers: { signature: sign(now, body), timestamp: "not-a-number" },
      signingSecret: SECRET,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "REPLAY_WINDOW" });
  });

  it("rejects when the signing secret is wrong", () => {
    const result = verifySlackSignature({
      rawBody: body,
      headers: { signature: sign(now, body, "wrong-secret"), timestamp: String(now) },
      signingSecret: SECRET,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "SIGNATURE_MISMATCH" });
  });

  it("rejects when the body has been tampered with", () => {
    const result = verifySlackSignature({
      rawBody: `${body}&injected=1`,
      headers: { signature: sign(now, body), timestamp: String(now) },
      signingSecret: SECRET,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "SIGNATURE_MISMATCH" });
  });

  it("rejects a signature of a different length without leaking timing info", () => {
    const result = verifySlackSignature({
      rawBody: body,
      headers: { signature: "v0=short", timestamp: String(now) },
      signingSecret: SECRET,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "SIGNATURE_MISMATCH" });
  });
});
