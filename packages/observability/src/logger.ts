export interface LogFields {
  service?: string;
  environment?: string;
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

type Level = "debug" | "info" | "warn" | "error";

function redact(fields: LogFields | undefined): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (REDACTED_KEYS.includes(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

function emit(level: Level, base: LogFields, msg: string, fields: LogFields | undefined): void {
  const record = {
    level,
    msg,
    ...redact(base),
    ...redact(fields),
  };
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${JSON.stringify(record)}\n`);
}

export function createLogger(base: LogFields): Logger {
  const bound: LogFields = { ...base };
  return {
    debug: (msg, fields) => emit("debug", bound, msg, fields),
    info: (msg, fields) => emit("info", bound, msg, fields),
    warn: (msg, fields) => emit("warn", bound, msg, fields),
    error: (msg, fields) => emit("error", bound, msg, fields),
    child: (bindings) => createLogger({ ...bound, ...bindings }),
  };
}
