import { createHmac, timingSafeEqual } from "node:crypto";

// docs/09-security-privacy-audit.md §Slack request verification.
// The raw request body must be preserved exactly. Reject timestamps outside the
// replay window BEFORE parsing business input. Use constant-time comparison.
export const REPLAY_WINDOW_SECONDS = 5 * 60;

export interface SignatureInput {
  rawBody: string;
  headers: {
    signature?: string;
    timestamp?: string;
  };
  signingSecret: string;
  nowSeconds: number;
}

export type SignatureResult =
  | { valid: true }
  | { valid: false; reason: "MISSING_HEADERS" | "REPLAY_WINDOW" | "SIGNATURE_MISMATCH" };

export function verifySlackSignature(input: SignatureInput): SignatureResult {
  const { rawBody, headers, signingSecret, nowSeconds } = input;
  const signature = headers.signature;
  const timestamp = headers.timestamp;

  if (!signature || !timestamp) {
    return { valid: false, reason: "MISSING_HEADERS" };
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) {
    return { valid: false, reason: "REPLAY_WINDOW" };
  }

  if (Math.abs(nowSeconds - timestampNumber) > REPLAY_WINDOW_SECONDS) {
    return { valid: false, reason: "REPLAY_WINDOW" };
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${createHmac("sha256", signingSecret).update(base).digest("hex")}`;

  const computedBuf = Buffer.from(computed, "utf8");
  const providedBuf = Buffer.from(signature, "utf8");
  if (computedBuf.length !== providedBuf.length) {
    return { valid: false, reason: "SIGNATURE_MISMATCH" };
  }
  if (!timingSafeEqual(computedBuf, providedBuf)) {
    return { valid: false, reason: "SIGNATURE_MISMATCH" };
  }

  return { valid: true };
}
