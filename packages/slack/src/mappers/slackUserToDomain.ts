import type { SlackUser } from "@nominate/domain";

// docs/03 §Slack identity handling. Slack's users.info payload nests identity
// signals across the user object and its profile — we only look at the fields
// the eligibility rules need and never retain the full profile.
interface RawSlackUser {
  id?: unknown;
  team_id?: unknown;
  deleted?: unknown;
  is_bot?: unknown;
  is_app_user?: unknown;
  is_restricted?: unknown;
  is_ultra_restricted?: unknown;
  is_stranger?: unknown;
  is_invited_user?: unknown;
  profile?: {
    team?: unknown;
    display_name?: unknown;
    display_name_normalized?: unknown;
    real_name?: unknown;
    real_name_normalized?: unknown;
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function slackProfileToDomain(profile: unknown): SlackUser {
  const raw = (profile ?? {}) as RawSlackUser;

  const slackId = stringOrUndefined(raw.id);
  if (!slackId) {
    throw new Error("slackProfileToDomain: missing user id");
  }
  const teamId =
    stringOrUndefined(raw.team_id) ?? stringOrUndefined(raw.profile?.team);
  if (!teamId) {
    throw new Error("slackProfileToDomain: missing team id");
  }

  const displayName =
    stringOrUndefined(raw.profile?.display_name) ??
    stringOrUndefined(raw.profile?.display_name_normalized) ??
    stringOrUndefined(raw.profile?.real_name) ??
    stringOrUndefined(raw.profile?.real_name_normalized);

  return {
    slackId,
    teamId,
    isBot: raw.is_bot === true,
    isApp: raw.is_app_user === true,
    isGuest: raw.is_restricted === true || raw.is_ultra_restricted === true,
    isDeactivated: raw.deleted === true,
    isExternal: raw.is_stranger === true || raw.is_invited_user === true,
    ...(displayName ? { displayName } : {}),
  };
}
