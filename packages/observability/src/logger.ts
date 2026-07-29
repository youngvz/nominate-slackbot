import { NotImplementedError } from "./errors.js";

export interface LogFields {
  service: string;
  environment: string;
  correlationId?: string;
  workspaceId?: string;
  eventType?: string;
  outcome?: string;
  durationMs?: number;
  dependency?: string;
  dependencyStatus?: "ok" | "retryable" | "non_retryable";
  errorCategory?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(bindings: Partial<LogFields>): Logger;
}

// Redaction key list must match docs/09 §Logging rules: no descriptions, tokens,
// signing secrets, raw bodies, or full user profiles.
export const REDACTED_KEYS: readonly string[] = [
  "description",
  "token",
  "bot_token",
  "signing_secret",
  "body",
  "rawBody",
  "profile",
];

export function createLogger(_base: LogFields): Logger {
  throw new NotImplementedError("createLogger");
}
