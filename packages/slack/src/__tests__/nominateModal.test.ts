import { describe, expect, it } from "vitest";
import {
  NOMINATE_CALLBACK_ID,
  NOMINATE_DESCRIPTION_ACTION_ID,
  NOMINATE_DESCRIPTION_BLOCK_ID,
  NOMINATE_DESCRIPTION_MAX_LENGTH,
  NOMINATE_DESCRIPTION_MIN_LENGTH,
  NOMINATE_RECIPIENT_ACTION_ID,
  NOMINATE_RECIPIENT_BLOCK_ID,
  buildNominateModalView,
} from "../blocks/nominateModal.js";

describe("buildNominateModalView", () => {
  const view = buildNominateModalView();

  it("is a modal with the nominate callback id", () => {
    expect(view.type).toBe("modal");
    expect(view.callback_id).toBe(NOMINATE_CALLBACK_ID);
  });

  it("has a recipient users_select input", () => {
    const block = view.blocks.find(
      (b): b is Record<string, unknown> =>
        typeof b === "object" &&
        b !== null &&
        (b as Record<string, unknown>).block_id === NOMINATE_RECIPIENT_BLOCK_ID,
    );
    expect(block).toBeDefined();
    const element = block!.element as Record<string, unknown>;
    expect(element.type).toBe("users_select");
    expect(element.action_id).toBe(NOMINATE_RECIPIENT_ACTION_ID);
  });

  it("has a multiline description input with 10-1000 char bounds", () => {
    const block = view.blocks.find(
      (b): b is Record<string, unknown> =>
        typeof b === "object" &&
        b !== null &&
        (b as Record<string, unknown>).block_id === NOMINATE_DESCRIPTION_BLOCK_ID,
    );
    expect(block).toBeDefined();
    const element = block!.element as Record<string, unknown>;
    expect(element.type).toBe("plain_text_input");
    expect(element.action_id).toBe(NOMINATE_DESCRIPTION_ACTION_ID);
    expect(element.multiline).toBe(true);
    expect(element.min_length).toBe(NOMINATE_DESCRIPTION_MIN_LENGTH);
    expect(element.max_length).toBe(NOMINATE_DESCRIPTION_MAX_LENGTH);
    expect(NOMINATE_DESCRIPTION_MIN_LENGTH).toBe(10);
    expect(NOMINATE_DESCRIPTION_MAX_LENGTH).toBe(1000);
  });
});
