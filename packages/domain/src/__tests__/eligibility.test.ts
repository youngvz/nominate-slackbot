import { describe, expect, it } from "vitest";
import type { SlackUser } from "../entities/SlackUser.js";
import { evaluateRecipientEligibility } from "../services/eligibility.js";

const WORKSPACE = "T_WORKSPACE";
const NOMINATOR = { slackId: "U_NOMINATOR", teamIds: [WORKSPACE] as const };

function user(overrides: Partial<SlackUser> = {}): SlackUser {
  return {
    slackId: "U_RECIPIENT",
    teamIds: [WORKSPACE],
    isBot: false,
    isApp: false,
    isGuest: false,
    isDeactivated: false,
    isExternal: false,
    ...overrides,
  };
}

describe("evaluateRecipientEligibility", () => {
  it("accepts an active same-workspace human", () => {
    expect(evaluateRecipientEligibility(NOMINATOR, user(), WORKSPACE)).toEqual({
      eligible: true,
    });
  });

  it("rejects a recipient in another workspace", () => {
    expect(
      evaluateRecipientEligibility(NOMINATOR, user({ teamIds: ["T_OTHER"] }), WORKSPACE),
    ).toEqual({ eligible: false, reason: "OTHER_WORKSPACE" });
  });

  it("accepts a Grid recipient whose enterprise_user.teams contains the workspace", () => {
    // Enterprise Grid users can belong to multiple workspaces inside one org.
    // The recipient is eligible as long as the nominator's workspace is in
    // the set (docs/03 §Slack identity handling).
    expect(
      evaluateRecipientEligibility(
        NOMINATOR,
        user({ teamIds: ["T_OTHER", WORKSPACE, "T_ANOTHER"] }),
        WORKSPACE,
      ),
    ).toEqual({ eligible: true });
  });

  it("rejects a Grid recipient whose teams list does not contain the workspace", () => {
    expect(
      evaluateRecipientEligibility(
        NOMINATOR,
        user({ teamIds: ["T_OTHER", "T_ANOTHER"] }),
        WORKSPACE,
      ),
    ).toEqual({ eligible: false, reason: "OTHER_WORKSPACE" });
  });

  it("rejects a deactivated recipient", () => {
    expect(
      evaluateRecipientEligibility(NOMINATOR, user({ isDeactivated: true }), WORKSPACE),
    ).toEqual({ eligible: false, reason: "DEACTIVATED" });
  });

  it("rejects a bot recipient", () => {
    expect(
      evaluateRecipientEligibility(NOMINATOR, user({ isBot: true }), WORKSPACE),
    ).toEqual({ eligible: false, reason: "BOT" });
  });

  it("rejects a guest recipient", () => {
    expect(
      evaluateRecipientEligibility(NOMINATOR, user({ isGuest: true }), WORKSPACE),
    ).toEqual({ eligible: false, reason: "GUEST" });
  });

  it("rejects an external/Slack Connect recipient", () => {
    expect(
      evaluateRecipientEligibility(NOMINATOR, user({ isExternal: true }), WORKSPACE),
    ).toEqual({ eligible: false, reason: "EXTERNAL" });
  });
});
