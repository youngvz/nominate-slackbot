import { NotImplementedError } from "@nominate/observability";

export function buildReminderMessage(_scheduledAtIso: string): { text: string; blocks: unknown[] } {
  throw new NotImplementedError("buildReminderMessage");
}
