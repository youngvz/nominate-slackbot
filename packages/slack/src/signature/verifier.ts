import { NotImplementedError } from "@nominate/observability";

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

export function verifySlackSignature(_input: SignatureInput): SignatureResult {
  throw new NotImplementedError("verifySlackSignature");
}
