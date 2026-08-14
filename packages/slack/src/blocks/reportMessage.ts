import { PROGRAM_DISCLAIMER } from "../copy/messages.js";

// docs/02 §Publication rules + docs/10 §Public message. Names every recipient
// who received ≥1 nomination this period. Never publishes nominator identities,
// descriptions, or per-recipient counts — recognition, not competition (see
// docs/adr/ADR-007). Callers must route empty periods to buildEmptyPeriodMessage.
//
// Recipient IDs are sorted so retries produce byte-identical text; the report
// job's idempotency assumes the same input yields the same message.
export function buildReportMessage(input: {
  periodStart: string;
  periodEnd: string;
  recipientSlackIds: readonly string[];
}): { text: string; blocks: unknown[] } {
  const sorted = [...input.recipientSlackIds].sort();
  const mentions = sorted.map((id) => `<@${id}>`).join(" · ");
  const summary = `Shoutout to the teammates recognized by their coworkers this period:\n\n${mentions}`;
  const text = `🎉 Recognition this period — ${mentions}`;

  return {
    text,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "🎉 Recognition this period 🎉", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: summary },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: PROGRAM_DISCLAIMER }],
      },
    ],
  };
}
