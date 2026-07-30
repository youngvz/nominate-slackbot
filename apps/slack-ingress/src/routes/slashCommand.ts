import { buildNominateModalView, type SlackClient, type SlashCommandPayload } from "@nominate/slack";

// docs/03 §Slash command flow: ack immediately, then open modal via trigger_id.
// The ack (200 response) happens in the handler; this function is the async
// side-effect of opening the modal.
export async function handleSlashCommand(
  payload: SlashCommandPayload,
  slackClient: SlackClient,
): Promise<void> {
  await slackClient.openView({
    triggerId: payload.triggerId,
    view: buildNominateModalView(),
  });
}
