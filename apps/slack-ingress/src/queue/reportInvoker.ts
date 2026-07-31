import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { BiweeklyReportRequestedV1 } from "@nominate/contracts";
import type { Logger } from "@nominate/observability";
import type { AdminReportInvoker } from "../routes/adminReport.js";

// docs/03 §Admin surface. The ingress Lambda invokes the report Lambda
// asynchronously (Event invocation type) so the Slack ack is not gated on the
// report run — which can take several seconds for the public post + winner
// DMs.

export function createLambdaReportInvoker(opts: {
  functionName: string;
  region: string;
  client?: LambdaClient;
}): AdminReportInvoker {
  const client = opts.client ?? new LambdaClient({ region: opts.region });
  return {
    async invokeReport(event: BiweeklyReportRequestedV1) {
      const res = await client.send(
        new InvokeCommand({
          FunctionName: opts.functionName,
          // Async invocation. The ingress responds ephemerally to Slack once
          // the invocation is accepted (StatusCode 202); the report Lambda
          // does its own error handling and idempotency checks.
          InvocationType: "Event",
          Payload: Buffer.from(JSON.stringify(event)),
        }),
      );
      if (res.StatusCode !== undefined && res.StatusCode >= 300) {
        throw new Error(`Lambda invoke returned status ${res.StatusCode}`);
      }
    },
  };
}

// Local-dev / stubbed invoker used when REPORT_FUNCTION_NAME is unset. Logs
// the event payload (id-only per docs/09) and returns success.
export function createStubReportInvoker(logger: Logger): AdminReportInvoker {
  return {
    async invokeReport(event: BiweeklyReportRequestedV1) {
      logger.info("admin_report_stub_invoked", {
        outcome: "stubbed",
        eventType: event.eventType,
        workspaceId: event.workspaceId,
        periodStart: event.periodStart,
        forceRepublish: event.forceRepublish === true,
      });
    },
  };
}
