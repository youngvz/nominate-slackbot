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
// Order matters for the returned reason: workspace membership takes precedence,
// then deactivation, bot/app, guest, external. The nominator argument is kept
// for future policies (e.g. cross-workspace restrictions) even though only the
// workspace id is compared today.
//
// Enterprise Grid: SlackUser.teamIds carries every workspace the recipient
// belongs to (see packages/slack/mappers/slackUserToDomain). A recipient is in
// the nominator's workspace if that workspace id appears in the list.
export function evaluateRecipientEligibility(
  _nominator: Pick<SlackUser, "slackId" | "teamIds">,
  recipient: SlackUser,
  workspaceTeamId: string,
): RecipientEligibility {
  if (!recipient.teamIds.includes(workspaceTeamId)) {
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
