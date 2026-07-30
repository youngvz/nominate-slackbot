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
// Order matters for the returned reason: workspace mismatch takes precedence,
// then deactivation, bot/app, guest, external. The nominator argument is kept
// to make the workspace check explicit even though the workspace id is the
// authoritative comparison.
export function evaluateRecipientEligibility(
  _nominator: Pick<SlackUser, "slackId" | "teamId">,
  recipient: SlackUser,
  workspaceTeamId: string,
): RecipientEligibility {
  if (recipient.teamId !== workspaceTeamId) {
    return { eligible: false, reason: "OTHER_WORKSPACE" };
  }
  if (recipient.isDeactivated) {
    return { eligible: false, reason: "DEACTIVATED" };
  }
  if (recipient.isBot || recipient.isApp) {
    return { eligible: false, reason: "BOT" };
  }
  if (recipient.isGuest) {
    return { eligible: false, reason: "GUEST" };
  }
  if (recipient.isExternal) {
    return { eligible: false, reason: "EXTERNAL" };
  }
  return { eligible: true };
}
