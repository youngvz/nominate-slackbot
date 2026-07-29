import { NotImplementedError } from "@nominate/observability";
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

export function encodeEvent(_event: InternalEvent): {
  body: string;
  attributes: SqsMessageAttributes;
} {
  throw new NotImplementedError("encodeEvent");
}

export function decodeEvent(_body: string): InternalEvent {
  throw new NotImplementedError("decodeEvent");
}
