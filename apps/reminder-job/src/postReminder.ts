import { NotImplementedError } from "@nominate/observability";
import type { WeeklyReminderRequestedV1 } from "@nominate/contracts";

// Conditional put on REMINDER#{scheduledAt} claims the slot; only the claiming
// invocation posts. docs/05 §Reminder execution + docs/10 §Weekly reminder.
export function postReminder(_event: WeeklyReminderRequestedV1): Promise<void> {
  throw new NotImplementedError("postReminder");
}
