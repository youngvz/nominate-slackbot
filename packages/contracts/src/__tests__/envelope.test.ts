import { describe, expect, it } from "vitest";
import {
  UnsupportedSchemaVersionError,
  decodeEvent,
  encodeEvent,
} from "../messages/envelope.js";
import type { NominationSubmissionRequestedV1 } from "../messages/NominationSubmissionRequested.js";

const sampleEvent: NominationSubmissionRequestedV1 = {
  eventType: "nomination.submission.requested",
  schemaVersion: 1,
  correlationId: "cor-1",
  idempotencyKey: "idem-1",
  workspaceId: "T1",
  nominatorSlackId: "U1",
  recipientSlackId: "U2",
  description: "Great work leading the migration.",
  sourceChannelId: "C1",
  sourceType: "CHANNEL",
  responseContext: {
    responseUrl: "https://hooks.slack.example/xyz",
    submittedAt: "2026-08-01T15:00:00Z",
  },
};

describe("encodeEvent / decodeEvent", () => {
  it("round-trips a nomination submission event", () => {
    const encoded = encodeEvent(sampleEvent);
    expect(encoded.attributes.eventType).toBe("nomination.submission.requested");
    expect(encoded.attributes.schemaVersion).toBe("1");
    expect(encoded.attributes.correlationId).toBe("cor-1");
    expect(decodeEvent(encoded.body)).toEqual(sampleEvent);
  });

  it("omits correlationId from attributes when the event has none", () => {
    const reminder = {
      eventType: "reminder.weekly.requested" as const,
      schemaVersion: 1 as const,
      workspaceId: "T1",
      scheduledAt: "2026-08-07T13:00:00Z",
      executionKey: "reminder-2026-08-07",
    };
    const encoded = encodeEvent(reminder);
    expect(encoded.attributes.correlationId).toBeUndefined();
    expect(decodeEvent(encoded.body)).toEqual(reminder);
  });

  it("rejects unsupported major schema versions", () => {
    const body = JSON.stringify({ ...sampleEvent, schemaVersion: 2 });
    expect(() => decodeEvent(body)).toThrow(UnsupportedSchemaVersionError);
  });

  it("rejects missing schemaVersion", () => {
    expect(() => decodeEvent(JSON.stringify({ eventType: "x" }))).toThrow(
      UnsupportedSchemaVersionError,
    );
  });
});
