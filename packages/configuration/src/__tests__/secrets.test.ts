import type { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { describe, expect, it, vi } from "vitest";
import {
  createSecretsProvider,
  resolveBotToken,
  resolveSigningSecret,
  type SecretsClient,
} from "../secrets.js";

function stubClient(map: Record<string, string | undefined>): SecretsClient {
  return {
    send: vi.fn(async (cmd: GetSecretValueCommand) => {
      const arn = cmd.input.SecretId ?? "";
      const value = map[arn];
      return value === undefined ? {} : { SecretString: value };
    }),
  };
}

describe("createSecretsProvider", () => {
  it("fetches each secret once and caches the promise across getters", async () => {
    const client = stubClient({
      "arn:sig": "signing-value",
      "arn:bot": "xoxb-value",
    });
    const provider = createSecretsProvider({
      signingSecretArn: "arn:sig",
      botTokenArn: "arn:bot",
      region: "us-east-1",
      client,
    });

    const [sig1, sig2, bot1, bot2] = await Promise.all([
      provider.getSlackSigningSecret(),
      provider.getSlackSigningSecret(),
      provider.getSlackBotToken(),
      provider.getSlackBotToken(),
    ]);

    expect(sig1).toBe("signing-value");
    expect(sig2).toBe("signing-value");
    expect(bot1).toBe("xoxb-value");
    expect(bot2).toBe("xoxb-value");
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it("throws when Secrets Manager returns an empty SecretString", async () => {
    const client = stubClient({ "arn:sig": undefined });
    const provider = createSecretsProvider({
      signingSecretArn: "arn:sig",
      botTokenArn: "arn:bot",
      region: "us-east-1",
      client,
    });

    await expect(provider.getSlackSigningSecret()).rejects.toThrow(/signing secret/);
  });
});

const baseEnv = {
  NODE_ENV: "production" as const,
  SERVICE_NAME: "slack-ingress",
  AWS_REGION: "us-east-1",
  SLACK_RECOGNITION_CHANNEL_ID: "C1",
  SLACK_MAINTAINER_IDS: ["U1"] as const,
  PROGRAM_TIMEZONE: "America/New_York",
  PROGRAM_START_AT: "2026-07-31T00:00:00-04:00",
  DYNAMODB_TABLE_NAME: "app",
  NOMINATION_QUEUE_URL: "https://sqs/example",
};

describe("resolveSigningSecret / resolveBotToken", () => {
  it("prefers inline env vars over Secrets Manager", async () => {
    const client = stubClient({});
    const sig = await resolveSigningSecret(
      { ...baseEnv, SLACK_SIGNING_SECRET: "inline-sig" },
      client,
    );
    const bot = await resolveBotToken(
      { ...baseEnv, SLACK_BOT_TOKEN: "inline-bot" },
      client,
    );
    expect(sig).toBe("inline-sig");
    expect(bot).toBe("inline-bot");
    expect(client.send).not.toHaveBeenCalled();
  });

  it("fetches from Secrets Manager when only ARN is set", async () => {
    const client = stubClient({ "arn:sig": "sm-sig", "arn:bot": "sm-bot" });
    const sig = await resolveSigningSecret(
      { ...baseEnv, SLACK_SIGNING_SECRET_ARN: "arn:sig" },
      client,
    );
    const bot = await resolveBotToken(
      { ...baseEnv, SLACK_BOT_TOKEN_ARN: "arn:bot" },
      client,
    );
    expect(sig).toBe("sm-sig");
    expect(bot).toBe("sm-bot");
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it("does not fetch the other secret when only one is requested", async () => {
    const client = stubClient({ "arn:sig": "sm-sig", "arn:bot": "sm-bot" });
    await resolveBotToken(
      {
        ...baseEnv,
        SLACK_SIGNING_SECRET_ARN: "arn:sig",
        SLACK_BOT_TOKEN_ARN: "arn:bot",
      },
      client,
    );
    // The worker/reminder/report roles are only allowed to read the bot token
    // per docs/07 §IAM boundaries. Fetching the signing secret would 403.
    expect(client.send).toHaveBeenCalledTimes(1);
    const sentCommand = (client.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as
      | GetSecretValueCommand
      | undefined;
    expect(sentCommand?.input.SecretId).toBe("arn:bot");
  });

  it("throws when neither plaintext nor ARN is available", async () => {
    const client = stubClient({});
    await expect(resolveSigningSecret({ ...baseEnv }, client)).rejects.toThrow(
      /neither plaintext env var nor ARN/,
    );
  });
});
