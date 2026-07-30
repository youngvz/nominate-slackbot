// docs/10 §Weekly reminder. Short, encouraging nudge posted to the recognition
// channel every Friday. No secrets, no user-specific data — the same copy for
// every workspace member.
export function buildReminderMessage(): { text: string; blocks: unknown[] } {
  const summary =
    "Friday nudge — who impressed you this week? Use `/nominate` to recognize a coworker.";
  return {
    text: summary,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: summary },
      },
    ],
  };
}
