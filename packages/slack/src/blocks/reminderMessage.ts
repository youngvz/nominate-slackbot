// docs/10 §Weekly reminder. Short, encouraging nudge posted to the recognition
// channel on the scheduled cadence. Copy is day-agnostic so admin on-demand
// runs and dev invocations don't post a message that contradicts the day it
// was sent. No secrets, no user-specific data — the same copy for every
// workspace member.
export function buildReminderMessage(): { text: string; blocks: unknown[] } {
  const summary =
    "Weekly nudge — who impressed you this week? Use `/nominate` to recognize a coworker.";
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
