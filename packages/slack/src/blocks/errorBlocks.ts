import { NotImplementedError } from "@nominate/observability";

// View submission response errors (blocks-of-errors) for `response_action: "errors"`.
// docs/03 §Modal + §Response visibility.
export function modalFieldErrors(_errors: Record<string, string>): unknown {
  throw new NotImplementedError("modalFieldErrors");
}
