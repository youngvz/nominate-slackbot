import { NotImplementedError } from "@nominate/observability";

// Thin wrapper over packages/slack/src/signature/verifier — this file exists so
// Lambda-shaped concerns (headers extraction, error responses) can live here
// without leaking into the shared package.
export function verifyRequest(_input: {
  rawBody: string;
  headers: Record<string, string | undefined>;
  signingSecret: string;
  nowSeconds: number;
}): { ok: true } | { ok: false; statusCode: number } {
  throw new NotImplementedError("verifyRequest");
}
