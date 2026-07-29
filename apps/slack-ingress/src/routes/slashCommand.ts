import { NotImplementedError } from "@nominate/observability";
import type { SlashCommandPayload } from "@nominate/slack";

// docs/03 §Slash command flow: ack immediately, then open modal via trigger_id.
export function handleSlashCommand(_payload: SlashCommandPayload): Promise<void> {
  throw new NotImplementedError("handleSlashCommand");
}
