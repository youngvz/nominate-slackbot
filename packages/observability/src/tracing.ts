import { NotImplementedError } from "./errors.js";

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  recordException(err: unknown): void;
  end(): void;
}

export interface Tracer {
  startSpan(name: string): Span;
  inSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>;
}

export function createTracer(_service: string): Tracer {
  throw new NotImplementedError("createTracer");
}
