import type { ReminderExecutionItem } from "@nominate/domain";
import { keys } from "../keys.js";

const REMINDER_STATUSES: readonly ReminderExecutionItem["status"][] = [
  "PENDING",
  "POSTED",
  "FAILED",
];

// docs/05 §Reminder execution + docs/10 §Weekly reminder. A conditional PutItem
// on this row's PK/SK is what prevents duplicate posts on retry.
export function toReminderDdbItem(
  r: ReminderExecutionItem,
): Record<string, unknown> {
  return {
    PK: keys.reminderPK(r.workspaceId),
    SK: keys.reminderSK(r.scheduledAt),
    entityType: r.entityType,
    workspaceId: r.workspaceId,
    scheduledAt: r.scheduledAt,
    status: r.status,
    ...(r.publicMessageTs ? { publicMessageTs: r.publicMessageTs } : {}),
    ...(r.postedAt ? { postedAt: r.postedAt } : {}),
  };
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`fromReminderDdbItem: missing string attribute ${key}`);
  }
  return value;
}

export function fromReminderDdbItem(
  raw: Record<string, unknown>,
): ReminderExecutionItem {
  if (raw.entityType !== "REMINDER_EXECUTION") {
    throw new Error(
      `fromReminderDdbItem: invalid entityType ${String(raw.entityType)}`,
    );
  }
  const status = raw.status;
  if (
    typeof status !== "string" ||
    !REMINDER_STATUSES.includes(status as ReminderExecutionItem["status"])
  ) {
    throw new Error(`fromReminderDdbItem: invalid status ${String(status)}`);
  }
  const publicMessageTs =
    typeof raw.publicMessageTs === "string" ? raw.publicMessageTs : undefined;
  const postedAt = typeof raw.postedAt === "string" ? raw.postedAt : undefined;
  return {
    entityType: "REMINDER_EXECUTION",
    workspaceId: requireString(raw, "workspaceId"),
    scheduledAt: requireString(raw, "scheduledAt"),
    status: status as ReminderExecutionItem["status"],
    ...(publicMessageTs ? { publicMessageTs } : {}),
    ...(postedAt ? { postedAt } : {}),
  };
}
