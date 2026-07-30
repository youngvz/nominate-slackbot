import type { NominationSubmissionRequestedV1 } from "@nominate/contracts";
import {
  evaluateRecipientEligibility,
  type NominationItem,
  type NominationResult,
  periodContaining,
  validateDescription,
} from "@nominate/domain";
import type { Logger } from "@nominate/observability";
import type {
  EligibilityRepository,
  IdempotencyRepository,
  NominationRepository,
} from "@nominate/persistence";
import { COPY, slackProfileToDomain, type SlackClient } from "@nominate/slack";

// docs/04 §Nomination worker Lambda: deserialize, validate, resolve recipient,
// apply eligibility rules, run TransactWriteItems, send private feedback.

export interface ProcessMessageDeps {
  nominations: NominationRepository;
  eligibility: EligibilityRepository;
  idempotency: IdempotencyRepository;
  slack: SlackClient;
  recognitionChannelId: string;
  logger: Logger;
  now: () => number;
  newNominationId: () => string;
}

// Operational retention for nomination items — docs/05 §Retention: one year.
const NOMINATION_RETENTION_SECONDS = 365 * 24 * 60 * 60;

// Idempotency records outlive the modal-submission window a little; a small
// buffer covers Slack retry storms plus manual replays during triage.
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export async function processMessage(
  event: NominationSubmissionRequestedV1,
  deps: ProcessMessageDeps,
): Promise<NominationResult> {
  const log = deps.logger.child({
    correlationId: event.correlationId,
    workspaceId: event.workspaceId,
    eventType: event.eventType,
  });

  const cached = await deps.idempotency.lookup({
    workspaceId: event.workspaceId,
    interactionId: event.idempotencyKey,
  });
  if (cached) {
    log.info("nomination_replay", { outcome: cached.outcome });
    return cached;
  }

  const result = await evaluate(event, deps, log);

  await deps.slack
    .postMessage(await feedbackMessage(event, result, deps))
    .catch((err) => {
      log.warn("nomination_feedback_failed", {
        outcome: result.outcome,
        errorCategory: err instanceof Error ? err.name : "unknown",
      });
    });

  await deps.idempotency.store({
    workspaceId: event.workspaceId,
    interactionId: event.idempotencyKey,
    result,
    ttlEpochSec: Math.floor(deps.now() / 1000) + IDEMPOTENCY_TTL_SECONDS,
  });

  log.info("nomination_processed", { outcome: result.outcome });
  return result;
}

async function evaluate(
  event: NominationSubmissionRequestedV1,
  deps: ProcessMessageDeps,
  log: Logger,
): Promise<NominationResult> {
  if (event.nominatorSlackId === event.recipientSlackId) {
    return { outcome: "REJECTED_SELF_NOMINATION" };
  }

  const description = validateDescription(event.description);
  if (!description.ok) {
    return { outcome: "REJECTED_INVALID_DESCRIPTION", reason: description.reason };
  }

  const recipientProfile = await deps.slack.getUser(event.recipientSlackId);
  const recipient = slackProfileToDomain(recipientProfile);
  const eligibility = evaluateRecipientEligibility(
    { slackId: event.nominatorSlackId, teamId: event.workspaceId },
    recipient,
    event.workspaceId,
  );
  if (!eligibility.eligible) {
    log.info("nomination_ineligible_recipient", { errorCategory: eligibility.reason });
    return { outcome: "REJECTED_INELIGIBLE_RECIPIENT", reason: eligibility.reason };
  }

  const existing = await deps.eligibility.find({
    workspaceId: event.workspaceId,
    nominatorSlackId: event.nominatorSlackId,
    recipientSlackId: event.recipientSlackId,
  });
  if (existing && existing.nextEligibleAtEpoch > deps.now()) {
    return {
      outcome: "REJECTED_REPEAT_WINDOW",
      nextEligibleAt: existing.nextEligibleAt,
    };
  }

  const nomination = buildNominationItem(event, description.value, deps);
  return deps.nominations.acceptNomination({
    nomination,
    nowEpochMs: deps.now(),
    interactionId: event.idempotencyKey,
  });
}

function buildNominationItem(
  event: NominationSubmissionRequestedV1,
  description: string,
  deps: ProcessMessageDeps,
): NominationItem {
  const submittedAtEpochMs = Date.parse(event.responseContext.submittedAt);
  if (Number.isNaN(submittedAtEpochMs)) {
    throw new Error(`Invalid submittedAt: ${event.responseContext.submittedAt}`);
  }
  const period = periodContaining(submittedAtEpochMs);
  return {
    entityType: "NOMINATION",
    workspaceId: event.workspaceId,
    nominationId: deps.newNominationId(),
    nominatorSlackId: event.nominatorSlackId,
    recipientSlackId: event.recipientSlackId,
    description,
    submittedAt: event.responseContext.submittedAt,
    submittedAtEpochMs,
    reportPeriodStart: period.start,
    reportPeriodEnd: period.end,
    ...(event.sourceChannelId ? { sourceChannelId: event.sourceChannelId } : {}),
    sourceType: event.sourceType,
    status: "ACTIVE",
    retentionExpiresAt:
      Math.floor(submittedAtEpochMs / 1000) + NOMINATION_RETENTION_SECONDS,
  };
}

async function feedbackMessage(
  event: NominationSubmissionRequestedV1,
  result: NominationResult,
  deps: ProcessMessageDeps,
): Promise<{ channel: string; text: string }> {
  const { channel } = await deps.slack.openDm({ userSlackId: event.nominatorSlackId });
  return { channel, text: renderFeedback(event, result) };
}

function renderFeedback(
  event: NominationSubmissionRequestedV1,
  result: NominationResult,
): string {
  switch (result.outcome) {
    case "ACCEPTED":
      return COPY.success(event.recipientSlackId);
    case "REJECTED_SELF_NOMINATION":
      return COPY.selfNomination;
    case "REJECTED_INELIGIBLE_RECIPIENT":
      return COPY.ineligibleAccount;
    case "REJECTED_REPEAT_WINDOW":
      return COPY.duplicate(event.recipientSlackId, result.nextEligibleAt);
    case "REJECTED_INVALID_DESCRIPTION":
      return "Something was off with the description on that nomination. Please try again.";
  }
}

