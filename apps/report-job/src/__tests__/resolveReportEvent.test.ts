import { describe, expect, it } from "vitest";
import { FIRST_REPORT_ISO, PERIOD_LENGTH_MS } from "@nominate/domain";
import {
  resolveReportEvent,
  UnresolvableReportEventError,
} from "../resolveReportEvent.js";

const FIRST_REPORT_EPOCH = Date.parse(FIRST_REPORT_ISO);

describe("resolveReportEvent — scheduled path (empty payload)", () => {
  it("fills workspace + just-closed period from now + defaultWorkspaceId", () => {
    // Scheduled fire at the second report boundary → report on the first period.
    const now = FIRST_REPORT_EPOCH + PERIOD_LENGTH_MS;
    const resolved = resolveReportEvent(
      {},
      { now: () => now, defaultWorkspaceId: "T1" },
    );

    expect(resolved.eventType).toBe("report.biweekly.requested");
    expect(resolved.schemaVersion).toBe(1);
    expect(resolved.workspaceId).toBe("T1");
    expect(resolved.periodStart).toBe(new Date(FIRST_REPORT_EPOCH).toISOString());
    expect(resolved.periodEnd).toBe(new Date(now).toISOString());
    expect(resolved.scheduledAt).toBe(new Date(now).toISOString());
    expect(resolved.executionKey).toBe(
      `T1#${new Date(FIRST_REPORT_EPOCH).toISOString()}`,
    );
    expect(resolved.forceRepublish).toBeUndefined();
  });

  it("treats null and non-object inputs like an empty payload", () => {
    const now = FIRST_REPORT_EPOCH + PERIOD_LENGTH_MS;
    const resolvedNull = resolveReportEvent(null, {
      now: () => now,
      defaultWorkspaceId: "T1",
    });
    const resolvedString = resolveReportEvent("garbage", {
      now: () => now,
      defaultWorkspaceId: "T1",
    });
    expect(resolvedNull.workspaceId).toBe("T1");
    expect(resolvedString.workspaceId).toBe("T1");
  });

  it("throws before the first reporting period has closed", () => {
    // A minute after program start, well before the first report boundary.
    const now = FIRST_REPORT_EPOCH - PERIOD_LENGTH_MS / 2;
    expect(() =>
      resolveReportEvent(
        {},
        { now: () => now, defaultWorkspaceId: "T1" },
      ),
    ).toThrow(UnresolvableReportEventError);
  });

  it("throws when defaultWorkspaceId is not configured", () => {
    const now = FIRST_REPORT_EPOCH + PERIOD_LENGTH_MS;
    expect(() =>
      resolveReportEvent(
        {},
        { now: () => now, defaultWorkspaceId: undefined },
      ),
    ).toThrow(UnresolvableReportEventError);
  });
});

describe("resolveReportEvent — admin path (full payload)", () => {
  it("passes admin-provided fields through unchanged", () => {
    const now = FIRST_REPORT_EPOCH + PERIOD_LENGTH_MS + 1234;
    const resolved = resolveReportEvent(
      {
        eventType: "report.biweekly.requested",
        schemaVersion: 1,
        workspaceId: "T_ADMIN",
        scheduledAt: "2026-08-14T16:00:00.000Z",
        periodStart: "2026-07-31T04:00:00.000Z",
        periodEnd: "2026-08-14T16:00:00.000Z",
        executionKey: "T_ADMIN#2026-07-31#admin-abc",
        forceRepublish: true,
      },
      { now: () => now, defaultWorkspaceId: "T_DEFAULT" },
    );

    expect(resolved.workspaceId).toBe("T_ADMIN");
    expect(resolved.periodStart).toBe("2026-07-31T04:00:00.000Z");
    expect(resolved.periodEnd).toBe("2026-08-14T16:00:00.000Z");
    expect(resolved.executionKey).toBe("T_ADMIN#2026-07-31#admin-abc");
    expect(resolved.forceRepublish).toBe(true);
    expect(resolved.scheduledAt).toBe("2026-08-14T16:00:00.000Z");
  });

  it("rejects a payload with only one of periodStart / periodEnd", () => {
    const now = FIRST_REPORT_EPOCH + PERIOD_LENGTH_MS;
    expect(() =>
      resolveReportEvent(
        {
          workspaceId: "T_ADMIN",
          periodStart: "2026-07-31T04:00:00.000Z",
        },
        { now: () => now, defaultWorkspaceId: "T_DEFAULT" },
      ),
    ).toThrow(/PARTIAL_PERIOD/);
  });

  it("derives an executionKey when the caller omits it", () => {
    const now = FIRST_REPORT_EPOCH + PERIOD_LENGTH_MS;
    const resolved = resolveReportEvent(
      {
        workspaceId: "T_ADMIN",
        periodStart: "2026-07-31T04:00:00.000Z",
        periodEnd: "2026-08-14T16:00:00.000Z",
      },
      { now: () => now, defaultWorkspaceId: undefined },
    );
    expect(resolved.executionKey).toBe(
      "T_ADMIN#2026-07-31T04:00:00.000Z",
    );
  });
});
