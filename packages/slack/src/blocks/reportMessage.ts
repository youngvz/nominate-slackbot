import type { Winner } from "@nominate/domain";

// docs/02 §Publication rules + docs/10 §Public message. Winner mentions and
// nomination counts only — never nominator identities or descriptions.
export function buildReportMessage(input: {
  periodStart: string;
  periodEnd: string;
  winners: readonly Winner[];
}): { text: string; blocks: unknown[] } {
  const { winners } = input;
  const mentions = winners.map((w) => `<@${w.recipientSlackId}>`).join(", ");
  const count = winners[0]?.count ?? 0;
  const timesWord = count === 1 ? "time" : "times";
  const nominationsWord = count === 1 ? "nomination" : "nominations";
  const winnerWord = winners.length === 1 ? "winner" : "winners";
  const summary =
    winners.length === 1
      ? `Congrats to ${mentions}! 🏆 You were recognized *${count} ${timesWord}* this period.`
      : `Congrats to ${mentions}! 🏆 You tied for the top spot with *${count} ${nominationsWord} each* this period.`;

  const text = `🎉 This period's recognition ${winnerWord}: ${summary}`;

  return {
    text,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🎉 Recognition results 🎉", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: summary },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Thanks for taking the time to recognize your coworkers. 💛",
          },
        ],
      },
    ],
  };
}
