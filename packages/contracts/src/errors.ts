// Error categories from docs/06-event-contracts.md §Error contract.
export type InternalErrorCategory =
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "DEPENDENCY_RETRYABLE"
  | "DEPENDENCY_NON_RETRYABLE"
  | "CONFIGURATION_ERROR"
  | "UNEXPECTED_ERROR";

export interface CategorizedError {
  category: InternalErrorCategory;
  message: string;
  correlationId?: string;
  cause?: unknown;
}
