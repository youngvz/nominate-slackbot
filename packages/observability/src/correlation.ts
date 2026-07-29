import { AsyncLocalStorage } from "node:async_hooks";
import { NotImplementedError } from "./errors.js";

export interface CorrelationContext {
  correlationId: string;
  workspaceId?: string;
}

export const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export function getCorrelation(): CorrelationContext | undefined {
  return correlationStorage.getStore();
}

export function withCorrelation<T>(_ctx: CorrelationContext, _fn: () => Promise<T>): Promise<T> {
  throw new NotImplementedError("withCorrelation");
}

export function newCorrelationId(): string {
  throw new NotImplementedError("newCorrelationId");
}
