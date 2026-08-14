// docs/03-slack-app-design.md §Suggested copy. Verbatim strings; edit here only.
export const COPY = {
  success: (recipientSlackId: string) =>
    `Recognition for <@${recipientSlackId}> is in. Thanks for the shout-out.`,
  selfNomination: "Recognition is for teammates — pick someone else to celebrate.",
  duplicate: (recipientSlackId: string, localizedNextEligibleAt: string) =>
    `<@${recipientSlackId}> is already recognized this cycle. You can nominate them again after ${localizedNextEligibleAt}.`,
  ineligibleAccount: "That account can't receive recognition. Please pick an active teammate in this workspace.",
} as const;

// Appended to public channel posts (weekly reminder + biweekly report, winners
// and empty-period variants). Not shown in DMs or ephemeral responses. Edit
// here only — all three builders read from this constant.
export const PROGRAM_DISCLAIMER =
  "KudosBot is for informal peer recognition only and does not replace or impact formal employee reviews. Official performance evaluations continue through our standard HR process.";
