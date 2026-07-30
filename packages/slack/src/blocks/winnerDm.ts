// docs/10 §Winner DMs + docs/02 §Publication rules. Only descriptions received
// during the period — never nominator IDs, names, or handles.
export function buildWinnerDm(input: {
  periodStart: string;
  periodEnd: string;
  descriptions: readonly string[];
}): { text: string; blocks: unknown[] } {
  const { descriptions } = input;
  const headline =
    descriptions.length === 1
      ? "You were recognized this period. Here's what your coworker shared:"
      : `You were recognized ${descriptions.length} times this period. Here's what your coworkers shared:`;
  const bulleted = descriptions.map((d) => `• ${d}`).join("\n");
  const text = `${headline}\n${bulleted}`;

  return {
    text,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: headline },
      },
      ...descriptions.map((description) => ({
        type: "section",
        text: { type: "mrkdwn", text: `> ${description}` },
      })),
    ],
  };
}
