import type { WeeklyReminderRequestedV1 } from "@nominate/contracts";
import type { ReminderExecutionItem } from "@nominate/domain";
import type { Logger } from "@nominate/observability";
import type { ReminderRepository } from "@nominate/persistence";
import { buildReminderMessage, type SlackClient } from "@nominate/slack";

// docs/04 §Reminder Lambda + docs/10 §Weekly reminder. The REMINDER row's
// conditional put is the sole idempotency gate: only the invocation that
// claims the row proceeds to post.
export interface PostReminderDeps {
  reminders: ReminderRepository;
  slack: SlackClient;
  recognitionChannelId: string;
  logger: Logger;
  now: () => number;
}

export async function postReminder(
  event: WeeklyReminderRequestedV1,
  deps: PostReminderDeps,
): Promise<void> {
  const log = deps.logger.child({
    correlationId: event.executionKey,
    workspaceId: event.workspaceId,
    eventType: event.eventType,
  });

  const pending: ReminderExecutionItem = {
    entityType: "REMINDER_EXECUTION",
    workspaceId: event.workspaceId,
    scheduledAt: event.scheduledAt,
    status: "PENDING",
  };

  const { claimed } = await deps.reminders.claim(pending);
  if (!claimed) {
    log.info("reminder_replay_skipped", {
      outcome: "ALREADY_CLAIMED",
      scheduledAt: event.scheduledAt,
    });
    return;
  }

  const message = buildReminderMessage();
  // Phase 1 trade-off: if postMessage fails after the row was claimed, we
  // re-throw so EventBridge retries — but the claim row already exists, so
  // the retry short-circuits and no reminder is posted. Operators recover by
  // deleting the REMINDER row and re-invoking. Acceptable at Phase 1 scale.
  const posted = await deps.slack.postMessage({
    channel: deps.recognitionChannelId,
    text: message.text,
    blocks: message.blocks,
    workspaceId: event.workspaceId,
  });

  await deps.reminders.markPosted({
    workspaceId: event.workspaceId,
    scheduledAt: event.scheduledAt,
    publicMessageTs: posted.ts,
    postedAt: new Date(deps.now()).toISOString(),
  });

  log.info("reminder_posted", {
    outcome: "POSTED",
    channel: deps.recognitionChannelId,
  });
}
