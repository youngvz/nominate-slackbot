import { NotImplementedError } from "@nominate/observability";
import type { SlackUser } from "../entities/SlackUser.js";

export type RecipientIneligibleReason =
  | "GUEST"
  | "EXTERNAL"
  | "BOT"
  | "DEACTIVATED"
  | "OTHER_WORKSPACE";

export type RecipientEligibility =
  | { eligible: true }
  | { eligible: false; reason: RecipientIneligibleReason };

// docs/02-business-rules.md §Recipient eligibility.
export function evaluateRecipientEligibility(
  _nominator: Pick<SlackUser, "slackId" | "teamId">,
  _recipient: SlackUser,
  _workspaceTeamId: string,
): RecipientEligibility {
  throw new NotImplementedError("evaluateRecipientEligibility");
}
