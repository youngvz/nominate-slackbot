import { NotImplementedError } from "@nominate/observability";
import type { ReminderExecutionItem } from "@nominate/domain";

export function toReminderDdbItem(_r: ReminderExecutionItem): Record<string, unknown> {
  throw new NotImplementedError("toReminderDdbItem");
}

export function fromReminderDdbItem(_raw: Record<string, unknown>): ReminderExecutionItem {
  throw new NotImplementedError("fromReminderDdbItem");
}
