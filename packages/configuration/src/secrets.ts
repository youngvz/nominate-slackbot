import { NotImplementedError } from "@nominate/observability";

// docs/09 §Secrets: never log values, never commit them, never place them in
// SQS payloads or Terraform state. In-process cache is safe; disk is not.
export interface SecretsProvider {
  getSlackSigningSecret(): Promise<string>;
  getSlackBotToken(): Promise<string>;
}

export function createSecretsProvider(_opts: {
  signingSecretArn: string;
  botTokenArn: string;
  region: string;
}): SecretsProvider {
  throw new NotImplementedError("createSecretsProvider");
}
