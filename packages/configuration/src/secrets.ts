import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type { AppEnv } from "./env.js";

// docs/09 §Secrets: never log values, never commit them, never place them in
// SQS payloads or Terraform state. In-process cache is safe; disk is not.
export interface SecretsProvider {
  getSlackSigningSecret(): Promise<string>;
  getSlackBotToken(): Promise<string>;
}

export interface SecretsClient {
  send(command: GetSecretValueCommand): Promise<{ SecretString?: string }>;
}

export interface CreateSecretsProviderOptions {
  signingSecretArn: string;
  botTokenArn: string;
  region: string;
  client?: SecretsClient;
}

export function createSecretsProvider(
  opts: CreateSecretsProviderOptions,
): SecretsProvider {
  const client: SecretsClient =
    opts.client ?? new SecretsManagerClient({ region: opts.region });

  let signingSecret: Promise<string> | undefined;
  let botToken: Promise<string> | undefined;

  return {
    getSlackSigningSecret() {
      signingSecret ??= fetch(client, opts.signingSecretArn, "signing secret");
      return signingSecret;
    },
    getSlackBotToken() {
      botToken ??= fetch(client, opts.botTokenArn, "bot token");
      return botToken;
    },
  };
}

async function fetch(
  client: SecretsClient,
  arn: string,
  label: string,
): Promise<string> {
  const result = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  const value = result.SecretString;
  if (!value) {
    throw new Error(`Secrets Manager returned no SecretString for ${label}`);
  }
  return value;
}

// Resolves Slack signing secret + bot token, preferring plaintext env vars
// (local development) and falling back to Secrets Manager (AWS Lambda). Each
// app's cold-start getDeps calls this once and caches the result.
export interface ResolvedSlackSecrets {
  signingSecret: string;
  botToken: string;
}

export async function resolveSlackSecrets(
  env: AppEnv,
  clientOverride?: SecretsClient,
): Promise<ResolvedSlackSecrets> {
  const inlineSigning = env.SLACK_SIGNING_SECRET;
  const inlineBot = env.SLACK_BOT_TOKEN;
  if (inlineSigning && inlineBot) {
    return { signingSecret: inlineSigning, botToken: inlineBot };
  }
  if (!env.SLACK_SIGNING_SECRET_ARN || !env.SLACK_BOT_TOKEN_ARN) {
    throw new Error(
      "resolveSlackSecrets: neither plaintext env vars nor Secrets Manager ARNs are set",
    );
  }
  const provider = createSecretsProvider({
    signingSecretArn: env.SLACK_SIGNING_SECRET_ARN,
    botTokenArn: env.SLACK_BOT_TOKEN_ARN,
    region: env.AWS_REGION,
    ...(clientOverride ? { client: clientOverride } : {}),
  });
  const [signingSecret, botToken] = await Promise.all([
    inlineSigning ?? provider.getSlackSigningSecret(),
    inlineBot ?? provider.getSlackBotToken(),
  ]);
  return { signingSecret, botToken };
}
