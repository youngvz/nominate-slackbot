import { NotImplementedError } from "@nominate/observability";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ReminderExecutionItem } from "@nominate/domain";

// docs/05 §Reminder execution + docs/10 §Weekly reminder. Uses a conditional
// PutItem keyed by REMINDER#{scheduledAt} so a retry cannot post twice.
export interface ReminderRepository {
  claim(item: ReminderExecutionItem): Promise<{ claimed: boolean }>;
  markPosted(input: { workspaceId: string; scheduledAt: string; publicMessageTs: string; postedAt: string }): Promise<void>;
}

export function createReminderRepository(
  _client: DynamoDBDocumentClient,
  _tableName: string,
): ReminderRepository {
  throw new NotImplementedError("createReminderRepository");
}
