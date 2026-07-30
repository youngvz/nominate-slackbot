// Keys mirror docs/13-local-development.md §Environment variables. Never commit
// real values — see docs/09-security-privacy-audit.md §Open-source controls.
export interface AppEnv {
  NODE_ENV: "development" | "test" | "production";
  SERVICE_NAME: string;
  AWS_REGION: string;
  // ARN-based secrets used in AWS; optional for local dev where plaintext env
  // vars are used instead. Exactly one form must be present per secret.
  SLACK_SIGNING_SECRET_ARN?: string;
  SLACK_BOT_TOKEN_ARN?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_BOT_TOKEN?: string;
  SLACK_RECOGNITION_CHANNEL_ID: string;
  SLACK_MAINTAINER_IDS: readonly string[];
  PROGRAM_TIMEZONE: string;
  PROGRAM_START_AT: string;
  DYNAMODB_TABLE_NAME: string;
  NOMINATION_QUEUE_URL: string;
}

function required(source: NodeJS.ProcessEnv, key: string, missing: string[]): string {
  const value = source[key];
  if (value === undefined || value === "") {
    missing.push(key);
    return "";
  }
  return value;
}

function optional(source: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = source[key];
  return value === undefined || value === "" ? undefined : value;
}

function parseNodeEnv(value: string | undefined): AppEnv["NODE_ENV"] {
  if (value === "production" || value === "test") return value;
  return "development";
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const missing: string[] = [];

  const AWS_REGION = required(source, "AWS_REGION", missing);
  const SLACK_RECOGNITION_CHANNEL_ID = required(source, "SLACK_RECOGNITION_CHANNEL_ID", missing);
  const PROGRAM_TIMEZONE = required(source, "PROGRAM_TIMEZONE", missing);
  const PROGRAM_START_AT = required(source, "PROGRAM_START_AT", missing);
  const DYNAMODB_TABLE_NAME = required(source, "DYNAMODB_TABLE_NAME", missing);
  const NOMINATION_QUEUE_URL = required(source, "NOMINATION_QUEUE_URL", missing);

  const SLACK_SIGNING_SECRET_ARN = optional(source, "SLACK_SIGNING_SECRET_ARN");
  const SLACK_BOT_TOKEN_ARN = optional(source, "SLACK_BOT_TOKEN_ARN");
  const SLACK_SIGNING_SECRET = optional(source, "SLACK_SIGNING_SECRET");
  const SLACK_BOT_TOKEN = optional(source, "SLACK_BOT_TOKEN");

  if (!SLACK_SIGNING_SECRET_ARN && !SLACK_SIGNING_SECRET) {
    missing.push("SLACK_SIGNING_SECRET_ARN or SLACK_SIGNING_SECRET");
  }
  if (!SLACK_BOT_TOKEN_ARN && !SLACK_BOT_TOKEN) {
    missing.push("SLACK_BOT_TOKEN_ARN or SLACK_BOT_TOKEN");
  }

  const maintainerRaw = source.SLACK_MAINTAINER_IDS ?? "";
  const SLACK_MAINTAINER_IDS = maintainerRaw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    NODE_ENV: parseNodeEnv(source.NODE_ENV),
    SERVICE_NAME: source.SERVICE_NAME ?? "slack-ingress",
    AWS_REGION,
    ...(SLACK_SIGNING_SECRET_ARN ? { SLACK_SIGNING_SECRET_ARN } : {}),
    ...(SLACK_BOT_TOKEN_ARN ? { SLACK_BOT_TOKEN_ARN } : {}),
    ...(SLACK_SIGNING_SECRET ? { SLACK_SIGNING_SECRET } : {}),
    ...(SLACK_BOT_TOKEN ? { SLACK_BOT_TOKEN } : {}),
    SLACK_RECOGNITION_CHANNEL_ID,
    SLACK_MAINTAINER_IDS,
    PROGRAM_TIMEZONE,
    PROGRAM_START_AT,
    DYNAMODB_TABLE_NAME,
    NOMINATION_QUEUE_URL,
  };
}
