import { describe, expect, it } from "vitest";
import { slackProfileToDomain } from "../mappers/slackUserToDomain.js";

describe("slackProfileToDomain", () => {
  it("maps a typical active human user", () => {
    const user = slackProfileToDomain({
      id: "U123",
      team_id: "T123",
      deleted: false,
      is_bot: false,
      is_app_user: false,
      is_restricted: false,
      is_ultra_restricted: false,
      profile: { display_name: "Ada" },
    });
    expect(user).toEqual({
      slackId: "U123",
      teamIds: ["T123"],
      isBot: false,
      isApp: false,
      isGuest: false,
      isDeactivated: false,
      isExternal: false,
      displayName: "Ada",
    });
  });

  it("flags multi-channel and single-channel guests as guests", () => {
    expect(
      slackProfileToDomain({ id: "U1", team_id: "T", is_restricted: true }).isGuest,
    ).toBe(true);
    expect(
      slackProfileToDomain({ id: "U2", team_id: "T", is_ultra_restricted: true }).isGuest,
    ).toBe(true);
  });

  it("flags Slack Connect / stranger accounts as external", () => {
    expect(
      slackProfileToDomain({ id: "U3", team_id: "T", is_stranger: true }).isExternal,
    ).toBe(true);
    expect(
      slackProfileToDomain({ id: "U4", team_id: "T", is_invited_user: true }).isExternal,
    ).toBe(true);
  });

  it("flags deleted users as deactivated", () => {
    expect(
      slackProfileToDomain({ id: "U5", team_id: "T", deleted: true }).isDeactivated,
    ).toBe(true);
  });

  it("falls back to profile.team when top-level team_id is absent", () => {
    expect(
      slackProfileToDomain({ id: "U6", profile: { team: "T_FROM_PROFILE" } }).teamIds,
    ).toEqual(["T_FROM_PROFILE"]);
  });

  it("reads enterprise_user.teams for Enterprise Grid users", () => {
    // Grid users.info returns team_id: null and every workspace membership
    // under enterprise_user.teams.
    expect(
      slackProfileToDomain({
        id: "U7",
        team_id: null,
        enterprise_user: {
          id: "U7",
          enterprise_id: "E123",
          teams: ["T_A", "T_B"],
        },
      }).teamIds,
    ).toEqual(["T_A", "T_B"]);
  });

  it("prefers enterprise_user.teams over top-level team_id when both are present", () => {
    // Some Grid payloads carry both; enterprise_user is the fuller signal.
    expect(
      slackProfileToDomain({
        id: "U8",
        team_id: "T_TOP",
        enterprise_user: { teams: ["T_A", "T_B"] },
      }).teamIds,
    ).toEqual(["T_A", "T_B"]);
  });

  it("ignores non-string entries in enterprise_user.teams and falls back if none valid", () => {
    // Defensive: unknown payload shape should not throw. Empty grid list falls
    // through to the top-level team_id.
    expect(
      slackProfileToDomain({
        id: "U9",
        team_id: "T_FALLBACK",
        enterprise_user: { teams: [null, "", 42] },
      }).teamIds,
    ).toEqual(["T_FALLBACK"]);
  });

  it("throws when id is missing", () => {
    expect(() => slackProfileToDomain({ team_id: "T" })).toThrow(/missing user id/);
  });

  it("throws when no team membership can be resolved", () => {
    expect(() => slackProfileToDomain({ id: "U" })).toThrow(/missing team membership/);
  });
});
