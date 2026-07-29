import { NotImplementedError } from "@nominate/observability";

// docs/02 §Maintainer authorization + docs/09 §Authorization. Explicit allowlist
// is authoritative when Slack roles are broader than intended app access.
export interface MaintainerContext {
  actorSlackId: string;
  isSlackWorkspaceAdmin: boolean;
  isSlackWorkspaceOwner: boolean;
}

export function isMaintainer(
  _ctx: MaintainerContext,
  _allowlist: readonly string[],
): boolean {
  throw new NotImplementedError("isMaintainer");
}
