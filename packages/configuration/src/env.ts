import { NotImplementedError } from "@nominate/observability";

// Keys mirror docs/13-local-development.md §Environment variables. Never commit
// real values — see docs/09-security-privacy-audit.md §Open-source controls.
export interface AppEnv {
  NODE_ENV: "development" | "test" | "production";
  SERVICE_NAME: string;
  AWS_REGION: string;
  SLACK_SIGNING_SECRET_ARN: string;
  SLACK_BOT_TOKEN_ARN: string;
  SLACK_RECOGNITION_CHANNEL_ID: string;
  SLACK_MAINTAINER_IDS: readonly string[];
  PROGRAM_TIMEZONE: string;
  PROGRAM_START_AT: string;
  DYNAMODB_TABLE_NAME: string;
  NOMINATION_QUEUE_URL: string;
}

export function loadEnv(_source: NodeJS.ProcessEnv = process.env): AppEnv {
  throw new NotImplementedError("loadEnv");
}
