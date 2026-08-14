import { PROGRAM_DISCLAIMER } from "../copy/messages.js";

// docs/10 §Aggregation step 6: publish a no-activity message when the period
// is empty. docs/02 §Publication rules: still no nominator identities and no
// descriptions in the shared channel.
//
// One variant is picked at random per invocation for a bit of warmth. All
// variants are day-agnostic so admin on-demand runs read correctly at any
// time; all share the same soft nudge to use `/kudos`.

interface EmptyVariant {
  body: string;
  footer: string;
}

const EMPTY_VARIANTS: readonly EmptyVariant[] = [
  {
    body: "No nominations this period — but there's always next time! Use `/kudos` to recognize a coworker.",
    footer: "Someone on your team is probably doing something worth calling out. 💛",
  },
  {
    body: "Quiet period — no nominations came in. 🤔 Use `/kudos` to kick things off before the next report.",
    footer: "It only takes a minute to make someone's week.",
  },
  {
    body: "Crickets this period 🦗 — no nominations came in. Use `/kudos` to recognize a coworker; two weeks goes by fast.",
    footer: "Small shoutouts count too.",
  },
  {
    body: "Empty inbox this period. 📭 Use `/kudos` to give someone a shoutout — coworkers, teammates, that one person who saved the day.",
    footer: "Recognition compounds — start the streak. 💛",
  },
  {
    body: "No nominations landed this period. Who's been quietly making things better? Use `/kudos` to say thanks.",
    footer: "Great work often flies under the radar. Help us catch it. 💛",
  },
  {
    body: "Nothing to report this period — but that doesn't mean nothing happened. ✨ Use `/kudos` to recognize a coworker.",
    footer: "See you in two weeks.",
  },
];

export function buildEmptyPeriodMessage(_periodEnd: string): {
  text: string;
  blocks: unknown[];
} {
  const variant =
    EMPTY_VARIANTS[Math.floor(Math.random() * EMPTY_VARIANTS.length)]!;
  return {
    text: variant.body,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "Recognition results" },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: variant.body },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: variant.footer }],
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: PROGRAM_DISCLAIMER }],
      },
    ],
  };
}
