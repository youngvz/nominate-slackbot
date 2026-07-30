import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { InternalEvent, EncodedEvent } from "@nominate/contracts";
import { encodeEvent } from "@nominate/contracts";
import type { Logger } from "@nominate/observability";

export interface NominationPublisher {
  publish(event: InternalEvent): Promise<{ messageId: string }>;
}

// Real SQS. Used when NOMINATION_QUEUE_URL is an https:// SQS URL.
export function createSqsPublisher(opts: {
  queueUrl: string;
  region: string;
  client?: SQSClient;
}): NominationPublisher {
  const client = opts.client ?? new SQSClient({ region: opts.region });
  return {
    async publish(event) {
      const encoded = encodeEvent(event);
      const res = await client.send(
        new SendMessageCommand({
          QueueUrl: opts.queueUrl,
          MessageBody: encoded.body,
          MessageAttributes: attributesToSqs(encoded),
        }),
      );
      if (!res.MessageId) {
        throw new Error("sqs SendMessage returned no MessageId");
      }
      return { messageId: res.MessageId };
    },
  };
}

// Local-dev only. Used when NOMINATION_QUEUE_URL starts with `stdout://` — the
// event is logged with the description redacted and a synthetic messageId is
// returned so the handler still acks Slack the same way.
export function createStdoutPublisher(logger: Logger): NominationPublisher {
  let counter = 0;
  return {
    async publish(event) {
      counter += 1;
      const messageId = `local-${counter.toString(36)}`;
      const { description: _description, ...rest } =
        event as InternalEvent & { description?: string };
      logger.info("stdout_publish", {
        outcome: "enqueued",
        eventType: event.eventType,
        messageId,
        payload: rest,
      });
      return { messageId };
    },
  };
}

export function createPublisherFromEnv(opts: {
  queueUrl: string;
  region: string;
  logger: Logger;
}): NominationPublisher {
  if (opts.queueUrl.startsWith("stdout://")) {
    return createStdoutPublisher(opts.logger);
  }
  return createSqsPublisher({ queueUrl: opts.queueUrl, region: opts.region });
}

function attributesToSqs(encoded: EncodedEvent): Record<
  string,
  { DataType: "String"; StringValue: string }
> {
  const out: Record<string, { DataType: "String"; StringValue: string }> = {
    eventType: { DataType: "String", StringValue: encoded.attributes.eventType },
    schemaVersion: { DataType: "String", StringValue: encoded.attributes.schemaVersion },
  };
  if (encoded.attributes.correlationId) {
    out.correlationId = {
      DataType: "String",
      StringValue: encoded.attributes.correlationId,
    };
  }
  return out;
}
