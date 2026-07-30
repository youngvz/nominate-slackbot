// docs/10 §Aggregation step 6: publish a no-activity message when the period
// is empty. docs/02 §Publication rules: still no nominator identities and no
// descriptions in the shared channel.
export function buildEmptyPeriodMessage(_periodEnd: string): {
  text: string;
  blocks: unknown[];
} {
  const summary =
    "No nominations were submitted this period. Use `/nominate` to recognize a coworker.";
  return {
    text: summary,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Recognition results" },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: summary },
      },
    ],
  };
}
