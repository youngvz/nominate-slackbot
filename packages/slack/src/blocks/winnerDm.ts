// docs/10 §Winner DMs + docs/02 §Publication rules. Only descriptions received
// during the period — never nominator IDs, names, or handles.
//
// Headline and footer are each picked at random from independent pools so a
// recipient who wins multiple times sees varied copy. Every headline has a
// singular and plural form for the two count cases.

interface HeadlineVariant {
  single: string;
  plural: (count: number) => string;
}

const HEADLINES: readonly HeadlineVariant[] = [
  {
    single: "🎉 You were recognized this period! Here's what your coworker had to say:",
    plural: (n) => `🎉 You were recognized *${n} times* this period! Here's what your coworkers had to say:`,
  },
  {
    single: "Congrats! 🏆 Someone gave you a shoutout this period. Here's what they said:",
    plural: (n) => `Congrats! 🏆 *${n} people* gave you a shoutout this period. Here's what they said:`,
  },
  {
    single: "Great news — you made someone's period. ✨ Here's what they shared:",
    plural: (n) => `Great news — you made *${n} people's* period. ✨ Here's what they shared:`,
  },
  {
    single: "Someone appreciated you this period. 💛 Here's what they wanted you to know:",
    plural: (n) => `*${n} coworkers* appreciated you this period. 💛 Here's what they wanted you to know:`,
  },
  {
    single: "Your work didn't go unnoticed. 🌟 A coworker recognized you this period:",
    plural: (n) => `Your work didn't go unnoticed. 🌟 *${n} coworkers* recognized you this period:`,
  },
  {
    single: "🎊 Recognition unlocked! Here's what a coworker shared about you this period:",
    plural: (n) => `🎊 Recognition unlocked ×${n}! Here's what your coworkers shared about you this period:`,
  },
  {
    single: "You were recognized this period. Read on for what your coworker shared. 💛",
    plural: (n) => `You were recognized *${n} times* this period. Read on for what your coworkers shared. 💛`,
  },
];

const FOOTERS: readonly string[] = [
  "Well earned. Keep it up. 💛",
  "You should be proud — this is real appreciation from real teammates.",
  "Pass the good energy along — someone else is probably worth recognizing too. ✨",
  "Save this one for the tough days. 💛",
  "Recognition compounds. Thanks for being someone others notice.",
  "See you in the next report. 🎉",
];

function pick<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function buildWinnerDm(input: {
  periodStart: string;
  periodEnd: string;
  descriptions: readonly string[];
}): { text: string; blocks: unknown[] } {
  const { descriptions } = input;
  const headlineVariant = pick(HEADLINES);
  const headline =
    descriptions.length === 1
      ? headlineVariant.single
      : headlineVariant.plural(descriptions.length);
  const footer = pick(FOOTERS);

  const bulleted = descriptions.map((d) => `• ${d}`).join("\n");
  const text = `${headline}\n${bulleted}\n\n${footer}`;

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
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: footer }],
      },
    ],
  };
}
