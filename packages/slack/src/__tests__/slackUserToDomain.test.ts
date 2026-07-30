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
      teamId: "T123",
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
      slackProfileToDomain({ id: "U6", profile: { team: "T_FROM_PROFILE" } }).teamId,
    ).toBe("T_FROM_PROFILE");
  });

  it("throws when id or team is missing", () => {
    expect(() => slackProfileToDomain({ team_id: "T" })).toThrow();
    expect(() => slackProfileToDomain({ id: "U" })).toThrow();
  });
});
