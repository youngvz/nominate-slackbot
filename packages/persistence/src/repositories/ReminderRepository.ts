import {
  type DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { ReminderExecutionItem } from "@nominate/domain";
import { keys } from "../keys.js";
import { toReminderDdbItem } from "../mappers/reminder.js";

// docs/05 §Reminder execution + docs/10 §Weekly reminder. Uses a conditional
// PutItem keyed by REMINDER#{scheduledAt} so a retry cannot post twice.
export interface ReminderRepository {
  claim(item: ReminderExecutionItem): Promise<{ claimed: boolean }>;
  markPosted(input: {
    workspaceId: string;
    scheduledAt: string;
    publicMessageTs: string;
    postedAt: string;
  }): Promise<void>;
}

export function createReminderRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): ReminderRepository {
  return {
    async claim(item) {
      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: toReminderDdbItem(item),
            // (PK, SK) identifies the row; attribute_not_exists(PK) on a
            // PutItem is DynamoDB's canonical "row does not exist" check
            // against the target key. See docs/05 §Reminder execution.
            ConditionExpression: "attribute_not_exists(PK)",
          }),
        );
        return { claimed: true };
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          return { claimed: false };
        }
        throw err;
      }
    },

    async markPosted({ workspaceId, scheduledAt, publicMessageTs, postedAt }) {
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: {
            PK: keys.reminderPK(workspaceId),
            SK: keys.reminderSK(scheduledAt),
          },
          UpdateExpression:
            "SET #status = :posted, publicMessageTs = :ts, postedAt = :at",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: {
            ":posted": "POSTED",
            ":ts": publicMessageTs,
            ":at": postedAt,
          },
        }),
      );
    },
  };
}
