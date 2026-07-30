import { verifySlackSignature } from "@nominate/slack";

// Thin wrapper over packages/slack/src/signature/verifier — this file exists so
// Lambda-shaped concerns (headers extraction, error responses) can live here
// without leaking into the shared package.
export function verifyRequest(input: {
  rawBody: string;
  headers: Record<string, string | undefined>;
  signingSecret: string;
  nowSeconds: number;
}): { ok: true } | { ok: false; statusCode: number; reason: string } {
  const signature = pickHeader(input.headers, "x-slack-signature");
  const timestamp = pickHeader(input.headers, "x-slack-request-timestamp");

  const result = verifySlackSignature({
    rawBody: input.rawBody,
    headers: {
      ...(signature !== undefined ? { signature } : {}),
      ...(timestamp !== undefined ? { timestamp } : {}),
    },
    signingSecret: input.signingSecret,
    nowSeconds: input.nowSeconds,
  });

  if (result.valid) return { ok: true };

  const statusCode = result.reason === "MISSING_HEADERS" ? 400 : 401;
  return { ok: false, statusCode, reason: result.reason };
}

function pickHeader(
  headers: Record<string, string | undefined>,
  name: string,
): string | undefined {
  const direct = headers[name];
  if (direct !== undefined) return direct;
  const lowered = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowered && value !== undefined) return value;
  }
  return undefined;
}
