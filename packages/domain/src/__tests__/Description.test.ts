import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  validateDescription,
} from "../value/Description.js";

describe("validateDescription", () => {
  it("accepts a description at the minimum length", () => {
    const raw = "a".repeat(DESCRIPTION_MIN);
    expect(validateDescription(raw)).toEqual({ ok: true, value: raw });
  });

  it("accepts a description at the maximum length", () => {
    const raw = "a".repeat(DESCRIPTION_MAX);
    expect(validateDescription(raw)).toEqual({ ok: true, value: raw });
  });

  it("trims surrounding whitespace before checking length", () => {
    const inner = "a".repeat(DESCRIPTION_MIN);
    expect(validateDescription(`   ${inner}   `)).toEqual({ ok: true, value: inner });
  });

  it("rejects null/undefined as REQUIRED", () => {
    expect(validateDescription(null)).toEqual({ ok: false, reason: "REQUIRED" });
    expect(validateDescription(undefined)).toEqual({ ok: false, reason: "REQUIRED" });
  });

  it("rejects whitespace-only as REQUIRED", () => {
    expect(validateDescription("   \n\t  ")).toEqual({ ok: false, reason: "REQUIRED" });
  });

  it("rejects strings under the minimum as TOO_SHORT", () => {
    expect(validateDescription("a".repeat(DESCRIPTION_MIN - 1))).toEqual({
      ok: false,
      reason: "TOO_SHORT",
    });
  });

  it("rejects strings over the maximum as TOO_LONG", () => {
    expect(validateDescription("a".repeat(DESCRIPTION_MAX + 1))).toEqual({
      ok: false,
      reason: "TOO_LONG",
    });
  });
});
