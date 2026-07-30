import { validateDescription } from "@nominate/domain";
import type { NominationSubmissionRequestedV1 } from "@nominate/contracts";
import {
  NOMINATE_DESCRIPTION_BLOCK_ID,
  NOMINATE_RECIPIENT_BLOCK_ID,
  parseNominateSubmission,
} from "@nominate/slack";
import type { Logger } from "@nominate/observability";
import type { NominationPublisher } from "../queue/publisher.js";

// docs/03 §Modal + docs/04 §Slack ingress Lambda: validate at boundary, then
// enqueue for durable processing. This route responds to Slack view_submission
// callbacks: on validation failure it returns response_action=errors so Slack
// surfaces the message under the appropriate block; on success it publishes an
// event to SQS and returns an empty 200 which closes the modal.

export interface ViewSubmissionContext {
  nominatorSlackId: string;
  workspaceId: string;
  viewId: string;
  correlationId: string;
  responseUrl?: string;
  submittedAtIso: string;
}

export type ViewSubmissionResult =
  | { kind: "close" }
  | { kind: "errors"; errors: Record<string, string> };

export async function handleViewSubmission(
  view: unknown,
  ctx: ViewSubmissionContext,
  deps: { publisher: NominationPublisher; logger: Logger },
): Promise<ViewSubmissionResult> {
  const log = deps.logger.child({
    correlationId: ctx.correlationId,
    workspaceId: ctx.workspaceId,
    eventType: "view_submission",
  });

  const parsed = parseNominateSubmission(view);
  if (!parsed.ok) {
    log.warn("view_submission_parse_failed", {
      outcome: "rejected",
      errorCategory: parsed.reason,
    });
    if (parsed.reason === "MISSING_RECIPIENT") {
      return {
        kind: "errors",
        errors: { [NOMINATE_RECIPIENT_BLOCK_ID]: "Pick a coworker to nominate." },
      };
    }
    if (parsed.reason === "MISSING_DESCRIPTION") {
      return {
        kind: "errors",
        errors: { [NOMINATE_DESCRIPTION_BLOCK_ID]: "Please describe why you're nominating them." },
      };
    }
    // WRONG_CALLBACK: another modal from this app; close silently.
    return { kind: "close" };
  }

  const { recipientSlackId, descriptionRaw } = parsed.parsed;

  if (recipientSlackId === ctx.nominatorSlackId) {
    log.info("nomination_rejected", {
      outcome: "rejected",
      errorCategory: "SELF_NOMINATION",
    });
    return {
      kind: "errors",
      errors: { [NOMINATE_RECIPIENT_BLOCK_ID]: "You can't nominate yourself." },
    };
  }

  const description = validateDescription(descriptionRaw);
  if (!description.ok) {
    log.info("nomination_rejected", {
      outcome: "rejected",
      errorCategory: `DESCRIPTION_${description.reason}`,
    });
    return {
      kind: "errors",
      errors: { [NOMINATE_DESCRIPTION_BLOCK_ID]: descriptionErrorMessage(description.reason) },
    };
  }

  const event: NominationSubmissionRequestedV1 = {
    eventType: "nomination.submission.requested",
    schemaVersion: 1,
    correlationId: ctx.correlationId,
    idempotencyKey: `${ctx.workspaceId}:${ctx.viewId}`,
    workspaceId: ctx.workspaceId,
    nominatorSlackId: ctx.nominatorSlackId,
    recipientSlackId,
    description: description.value,
    sourceType: "CHANNEL",
    responseContext: {
      ...(ctx.responseUrl ? { responseUrl: ctx.responseUrl } : {}),
      submittedAt: ctx.submittedAtIso,
    },
  };

  const { messageId } = await deps.publisher.publish(event);
  log.info("nomination_enqueued", {
    outcome: "enqueued",
    messageId,
  });

  return { kind: "close" };
}

function descriptionErrorMessage(
  reason: "REQUIRED" | "TOO_SHORT" | "TOO_LONG",
): string {
  switch (reason) {
    case "REQUIRED":
      return "Please describe why you're nominating them.";
    case "TOO_SHORT":
      return "That's a bit short — please add more detail (10 characters minimum).";
    case "TOO_LONG":
      return "That's too long — please keep it under 1,000 characters.";
  }
}

