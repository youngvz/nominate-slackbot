import { PROGRAM_TIMEZONE } from "@nominate/domain";
import type { Logger } from "@nominate/observability";
import type { EligibilityRepository } from "@nominate/persistence";
import {
  buildNominateModalView,
  type AlreadyRecognized,
  type SlackClient,
  type SlashCommandPayload,
} from "@nominate/slack";

// docs/03 §Slash command flow: ack immediately, then open modal via trigger_id.
// The ack (200 response) happens in the handler; this function is the async
// side-effect of opening the modal.
export interface SlashCommandDeps {
  slackClient: SlackClient;
  eligibility: EligibilityRepository;
  logger: Logger;
  nowMs: () => number;
}

export async function handleSlashCommand(
  payload: SlashCommandPayload,
  deps: SlashCommandDeps,
): Promise<void> {
  const alreadyRecognized = await loadAlreadyRecognized(payload, deps);
  await deps.slackClient.openView({
    triggerId: payload.triggerId,
    view: buildNominateModalView({ alreadyRecognized }),
  });
}

// A stale/failed lookup should never break `/kudos` — the modal still opens
// without the hint. Slack's trigger_id also expires in 3s, so we can't wait
// forever if DynamoDB is slow.
async function loadAlreadyRecognized(
  payload: SlashCommandPayload,
  deps: SlashCommandDeps,
): Promise<AlreadyRecognized[]> {
  try {
    const now = deps.nowMs();
    const items = await deps.eligibility.listByNominator({
      workspaceId: payload.teamId,
      nominatorSlackId: payload.userId,
    });
    return items
      .filter((it) => it.nextEligibleAtEpoch > now)
      .map((it) => ({
        recipientSlackId: it.recipientSlackId,
        eligibleAgainDateLabel: formatEligibleAgain(it.nextEligibleAt),
      }));
  } catch (err) {
    deps.logger.warn("nominate_modal_hint_lookup_failed", {
      workspaceId: payload.teamId,
      errorCategory: err instanceof Error ? err.name : "unknown",
    });
    return [];
  }
}

const HINT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: PROGRAM_TIMEZONE,
  month: "short",
  day: "numeric",
});

function formatEligibleAgain(nextEligibleAtIso: string): string {
  const parsed = Date.parse(nextEligibleAtIso);
  if (Number.isNaN(parsed)) return nextEligibleAtIso;
  return HINT_DATE_FORMATTER.format(new Date(parsed));
}
