import { createServer, type IncomingMessage } from "node:http";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { handler } from "./index.js";

const PORT = Number(process.env.PORT ?? 3000);
const PATH = "/slack/events";

async function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function headersFromRequest(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(",") : value;
  }
  return out;
}

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== PATH) {
    res.statusCode = 404;
    res.end();
    return;
  }

  const bodyBuf = await readBody(req);
  const headers = headersFromRequest(req);

  const event: APIGatewayProxyEventV2 = {
    version: "2.0",
    routeKey: "$default",
    rawPath: PATH,
    rawQueryString: "",
    headers,
    requestContext: {
      accountId: "0",
      apiId: "local",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method: "POST",
        path: PATH,
        protocol: "HTTP/1.1",
        sourceIp: req.socket.remoteAddress ?? "127.0.0.1",
        userAgent: headers["user-agent"] ?? "",
      },
      requestId: `local-${Date.now().toString(36)}`,
      routeKey: "$default",
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: bodyBuf.toString("utf8"),
    isBase64Encoded: false,
  };

  try {
    const result = (await (handler as (e: APIGatewayProxyEventV2) => Promise<APIGatewayProxyStructuredResultV2>)(event));
    if (result && typeof result === "object" && "statusCode" in result) {
      res.statusCode = result.statusCode ?? 200;
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          if (v !== undefined) res.setHeader(k, String(v));
        }
      }
      res.end(result.body ?? "");
    } else {
      res.statusCode = 200;
      res.end();
    }
  } catch (err) {
    process.stderr.write(
      `${JSON.stringify({ level: "error", msg: "handler_threw", errorCategory: err instanceof Error ? err.name : "unknown" })}\n`,
    );
    res.statusCode = 500;
    res.end();
  }
});

server.listen(PORT, () => {
  process.stdout.write(
    `${JSON.stringify({ level: "info", msg: "slack_ingress_dev_listening", url: `http://localhost:${PORT}${PATH}` })}\n`,
  );
});
