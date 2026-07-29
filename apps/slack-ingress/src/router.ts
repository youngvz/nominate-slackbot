import { NotImplementedError } from "@nominate/observability";
import type { SlackInteraction } from "@nominate/slack";

export interface RouterResponse {
  statusCode: number;
  body?: string;
}

export function routeInteraction(_payload: SlackInteraction): Promise<RouterResponse> {
  throw new NotImplementedError("routeInteraction");
}
