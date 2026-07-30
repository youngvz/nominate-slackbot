// Fields inspected during recipient eligibility. See docs/03-slack-app-design.md
// §Slack identity handling and docs/02-business-rules.md §Recipient eligibility.
//
// teamIds is a list of workspaces the user belongs to. Non-Grid Slack always
// returns exactly one entry (from users.info#team_id); Enterprise Grid users
// carry every workspace inside the org via users.info#enterprise_user.teams.
// The eligibility check accepts the recipient if the nominator's workspace is
// in this set (docs/02 §Recipient eligibility — same workspace as nominator).
export interface SlackUser {
  slackId: string;
  teamIds: readonly string[];
  isBot: boolean;
  isApp: boolean;
  isGuest: boolean;
  isDeactivated: boolean;
  isExternal: boolean;
  displayName?: string;
}
