// docs/02-business-rules.md §Description rules.
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 1000;

export type DescriptionValidation =
  | { ok: true; value: string }
  | { ok: false; reason: "REQUIRED" | "TOO_SHORT" | "TOO_LONG" };

export function validateDescription(raw: string | null | undefined): DescriptionValidation {
  if (raw === null || raw === undefined) {
    return { ok: false, reason: "REQUIRED" };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "REQUIRED" };
  }
  if (trimmed.length < DESCRIPTION_MIN) {
    return { ok: false, reason: "TOO_SHORT" };
  }
  if (trimmed.length > DESCRIPTION_MAX) {
    return { ok: false, reason: "TOO_LONG" };
  }
  return { ok: true, value: trimmed };
}
