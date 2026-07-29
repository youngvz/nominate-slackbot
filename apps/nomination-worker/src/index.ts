import { NotImplementedError } from "@nominate/observability";
import type { SQSHandler } from "aws-lambda";

// docs/04 §Nomination worker Lambda + docs/06 §SQS behavior. Returns
// batchItemFailures for partial batch failure so poison messages don't block
// unrelated submissions.
export const handler: SQSHandler = async (_event) => {
  throw new NotImplementedError("nomination-worker handler");
};
