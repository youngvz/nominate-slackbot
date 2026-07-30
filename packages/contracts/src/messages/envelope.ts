import type { NominationSubmissionRequestedV1 } from "./NominationSubmissionRequested.js";
import type { WeeklyReminderRequestedV1 } from "./WeeklyReminderRequested.js";
import type { BiweeklyReportRequestedV1 } from "./BiweeklyReportRequested.js";

export type InternalEvent =
  | NominationSubmissionRequestedV1
  | WeeklyReminderRequestedV1
  | BiweeklyReportRequestedV1;

export const SUPPORTED_SCHEMA_VERSIONS = { major: 1 } as const;

export interface SqsMessageAttributes {
  eventType: string;
  schemaVersion: string;
  correlationId?: string;
}

export interface EncodedEvent {
  body: string;
  attributes: SqsMessageAttributes;
}

export class UnsupportedSchemaVersionError extends Error {
  readonly code = "UNSUPPORTED_SCHEMA_VERSION";
  constructor(readonly received: number) {
    super(`Unsupported event schemaVersion: ${received}`);
    this.name = "UnsupportedSchemaVersionError";
  }
}

export function encodeEvent(event: InternalEvent): EncodedEvent {
  return {
    body: JSON.stringify(event),
    attributes: {
      eventType: event.eventType,
      schemaVersion: String(event.schemaVersion),
      ...("correlationId" in event && typeof event.correlationId === "string"
        ? { correlationId: event.correlationId }
        : {}),
    },
  };
}

export function decodeEvent(body: string): InternalEvent {
  const parsed = JSON.parse(body) as { schemaVersion?: unknown };
  const version = parsed.schemaVersion;
  if (typeof version !== "number" || version !== SUPPORTED_SCHEMA_VERSIONS.major) {
    throw new UnsupportedSchemaVersionError(
      typeof version === "number" ? version : Number.NaN,
    );
  }
  return parsed as InternalEvent;
}
