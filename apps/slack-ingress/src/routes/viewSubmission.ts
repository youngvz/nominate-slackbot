import { NotImplementedError } from "@nominate/observability";
import type { ViewSubmissionPayload } from "@nominate/slack";

// docs/03 §Modal + docs/04 §Slack ingress Lambda: validate at boundary, then
// enqueue for durable processing.
export function handleViewSubmission(_payload: ViewSubmissionPayload): Promise<{
  responseAction?: "errors" | "clear";
  errors?: Record<string, string>;
}> {
  throw new NotImplementedError("handleViewSubmission");
}
