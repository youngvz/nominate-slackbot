// Fields inspected during recipient eligibility. See docs/03-slack-app-design.md
// §Slack identity handling and docs/02-business-rules.md §Recipient eligibility.
export interface SlackUser {
  slackId: string;
  teamId: string;
  isBot: boolean;
  isApp: boolean;
  isGuest: boolean;
  isDeactivated: boolean;
  isExternal: boolean;
  displayName?: string;
}
