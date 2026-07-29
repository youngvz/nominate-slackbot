import { NotImplementedError } from "@nominate/observability";

// docs/02-business-rules.md §Description rules.
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 1000;

export type DescriptionValidation =
  | { ok: true; value: string }
  | { ok: false; reason: "REQUIRED" | "TOO_SHORT" | "TOO_LONG" };

export function validateDescription(_raw: string): DescriptionValidation {
  throw new NotImplementedError("validateDescription");
}
