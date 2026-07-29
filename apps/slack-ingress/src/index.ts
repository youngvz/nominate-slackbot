import { NotImplementedError } from "@nominate/observability";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

// Entry point for the API Gateway HTTP API. docs/04 §Slack ingress Lambda:
// preserve the raw body, verify signature, acknowledge within Slack's trigger
// deadline, avoid slow calls on the ack path.
export const handler: APIGatewayProxyHandlerV2 = async (_event) => {
  throw new NotImplementedError("slack-ingress handler");
};
