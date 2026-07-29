import { NotImplementedError } from "@nominate/observability";
import type { Handler } from "aws-lambda";
import type { WeeklyReminderRequestedV1 } from "@nominate/contracts";

// docs/10 §Weekly reminder. Fridays 9:00 AM America/New_York starting
// 2026-08-07. Deterministic execution key prevents duplicate posts.
export const handler: Handler<WeeklyReminderRequestedV1, void> = async (_event) => {
  throw new NotImplementedError("reminder-job handler");
};
