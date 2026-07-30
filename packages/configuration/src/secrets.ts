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

// Individually-lazy secret resolvers. Each Lambda's IAM role only grants read
// access to the secrets it actually needs (docs/07 §IAM boundaries), so
// fetching secrets it doesn't consume would fail with AccessDeniedException.
// A resolver only touches Secrets Manager for its own ARN.

async function resolveOne(
  env: AppEnv,
  which: "signing" | "bot",
  clientOverride?: SecretsClient,
): Promise<string> {
  const inline = which === "signing" ? env.SLACK_SIGNING_SECRET : env.SLACK_BOT_TOKEN;
  if (inline) return inline;

  const arn = which === "signing" ? env.SLACK_SIGNING_SECRET_ARN : env.SLACK_BOT_TOKEN_ARN;
  if (!arn) {
    const label = which === "signing" ? "signing secret" : "bot token";
    throw new Error(
      `resolveSlackSecret: neither plaintext env var nor ARN is set for the Slack ${label}`,
    );
  }

  const client = clientOverride ?? new SecretsManagerClient({ region: env.AWS_REGION });
  const result = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  const value = result.SecretString;
  if (!value) {
    throw new Error(
      `Secrets Manager returned no SecretString for the Slack ${which === "signing" ? "signing secret" : "bot token"}`,
    );
  }
  return value;
}

export function resolveSigningSecret(
  env: AppEnv,
  clientOverride?: SecretsClient,
): Promise<string> {
  return resolveOne(env, "signing", clientOverride);
}

export function resolveBotToken(
  env: AppEnv,
  clientOverride?: SecretsClient,
): Promise<string> {
  return resolveOne(env, "bot", clientOverride);
}
