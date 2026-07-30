import { describe, expect, it } from "vitest";
import {
  NOMINATE_CALLBACK_ID,
  NOMINATE_DESCRIPTION_ACTION_ID,
  NOMINATE_DESCRIPTION_BLOCK_ID,
  NOMINATE_RECIPIENT_ACTION_ID,
  NOMINATE_RECIPIENT_BLOCK_ID,
} from "../blocks/nominateModal.js";
import { parseNominateSubmission } from "../blocks/nominateModalParser.js";

function viewWith(recipient: string | null, description: string | null): unknown {
  return {
    callback_id: NOMINATE_CALLBACK_ID,
    state: {
      values: {
        [NOMINATE_RECIPIENT_BLOCK_ID]:
          recipient === null
            ? {}
            : {
                [NOMINATE_RECIPIENT_ACTION_ID]: { selected_user: recipient },
              },
        [NOMINATE_DESCRIPTION_BLOCK_ID]:
          description === null
            ? {}
            : {
                [NOMINATE_DESCRIPTION_ACTION_ID]: { value: description },
              },
      },
    },
  };
}

describe("parseNominateSubmission", () => {
  it("extracts recipient and description from a well-formed view", () => {
    const result = parseNominateSubmission(viewWith("U123", "Nice work"));
    expect(result).toEqual({
      ok: true,
      parsed: {
        callbackId: NOMINATE_CALLBACK_ID,
        recipientSlackId: "U123",
        descriptionRaw: "Nice work",
      },
    });
  });

  it("returns WRONG_CALLBACK when the callback_id is not ours", () => {
    const view = viewWith("U1", "x");
    (view as { callback_id: string }).callback_id = "something_else";
    expect(parseNominateSubmission(view)).toEqual({ ok: false, reason: "WRONG_CALLBACK" });
  });

  it("returns MISSING_RECIPIENT when selected_user is absent", () => {
    expect(parseNominateSubmission(viewWith(null, "x"))).toEqual({
      ok: false,
      reason: "MISSING_RECIPIENT",
    });
  });

  it("returns MISSING_DESCRIPTION when value is absent", () => {
    expect(parseNominateSubmission(viewWith("U1", null))).toEqual({
      ok: false,
      reason: "MISSING_DESCRIPTION",
    });
  });

  it("passes through empty description string for the domain validator to reject", () => {
    expect(parseNominateSubmission(viewWith("U1", ""))).toEqual({
      ok: true,
      parsed: {
        callbackId: NOMINATE_CALLBACK_ID,
        recipientSlackId: "U1",
        descriptionRaw: "",
      },
    });
  });
});
