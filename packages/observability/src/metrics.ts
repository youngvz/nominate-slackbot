import { NotImplementedError } from "./errors.js";

// Metric names from docs/11-observability-and-operations.md §Metrics.
export const MetricName = {
  NominationsReceived: "NominationsReceived",
  NominationsAccepted: "NominationsAccepted",
  SelfNominationRejected: "SelfNominationRejected",
  IneligibleRecipientRejected: "IneligibleRecipientRejected",
  RepeatWindowRejected: "RepeatWindowRejected",
  DynamoTransactionConflict: "DynamoTransactionConflict",
  SlackApiFailure: "SlackApiFailure",
  SlackRateLimited: "SlackRateLimited",
  SqsQueueAgeSeconds: "SqsQueueAgeSeconds",
  DlqMessageCount: "DlqMessageCount",
  ReminderPublishSuccess: "ReminderPublishSuccess",
  ReminderPublishFailure: "ReminderPublishFailure",
  ReportPublishSuccess: "ReportPublishSuccess",
  ReportPublishFailure: "ReportPublishFailure",
  WinnerDmSuccess: "WinnerDmSuccess",
  WinnerDmFailure: "WinnerDmFailure",
  InvocationDurationMs: "InvocationDurationMs",
  InvocationErrors: "InvocationErrors",
} as const;
export type MetricName = (typeof MetricName)[keyof typeof MetricName];

export type MetricUnit = "Count" | "Milliseconds" | "Seconds";

export interface MetricSink {
  count(name: MetricName, value?: number, dims?: Record<string, string>): void;
  duration(name: MetricName, ms: number, dims?: Record<string, string>): void;
  flush(): Promise<void>;
}

export function createMetricSink(_namespace: string): MetricSink {
  throw new NotImplementedError("createMetricSink");
}
