// docs/03-slack-app-design.md §Suggested copy. Verbatim strings; edit here only.
export const COPY = {
  success: (recipientSlackId: string) =>
    `Your nomination for <@${recipientSlackId}> was recorded. Thanks for recognizing their work.`,
  selfNomination: "You cannot nominate yourself. Please choose another teammate.",
  duplicate: (recipientSlackId: string, localizedNextEligibleAt: string) =>
    `You already nominated <@${recipientSlackId}> within the last 14 days. You can nominate them again after ${localizedNextEligibleAt}.`,
  ineligibleAccount: "That account cannot receive nominations. Please choose an active employee in this workspace.",
} as const;
