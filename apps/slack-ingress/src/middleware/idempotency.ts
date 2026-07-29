import { NotImplementedError } from "@nominate/observability";

// Slack replays view_submission when its ack is slow; use view.id or a stable
// derivation as the idempotency key per docs/05 §Idempotency.
export function idempotencyKeyFromViewSubmission(_view: unknown): string {
  throw new NotImplementedError("idempotencyKeyFromViewSubmission");
}
