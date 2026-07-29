import { NotImplementedError } from "@nominate/observability";
import type { SlackUser } from "@nominate/domain";

// docs/03 §Slack identity handling. Inspect deleted status, bot/app identity,
// guest restrictions, workspace/team identity, and enterprise/external status.
export function slackProfileToDomain(_profile: unknown): SlackUser {
  throw new NotImplementedError("slackProfileToDomain");
}
