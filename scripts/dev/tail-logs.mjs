#!/usr/bin/env node
// Follow CloudWatch logs for all four dev Lambdas at once, with a short
// color-coded prefix per source so you can tell them apart when they
// interleave.
//
// Wraps `aws logs tail --follow` (one child per log group) so you don't have
// to run four terminals. Requires the AWS CLI on PATH.
//
// Usage:
//   pnpm dev:tail                    # all four dev Lambdas
//   pnpm dev:tail --only worker      # substring match — pick the group by
//                                    #  keyword (worker|ingress|report|reminder)
//   pnpm dev:tail --since 30m        # rewind before tailing (default 5m)
//   pnpm dev:tail --env dev|production

import { spawn } from "node:child_process";
import { projectFor } from "./lib/project.mjs";

const APPS = [
  { key: "ingress",  logGroup: (env) => `/aws/lambda/${projectFor(env)}-${env}-slack-ingress`,     prefix: "INGRESS  ", color: "\x1b[36m" }, // cyan
  { key: "worker",   logGroup: (env) => `/aws/lambda/${projectFor(env)}-${env}-nomination-worker`, prefix: "WORKER   ", color: "\x1b[35m" }, // magenta
  { key: "report",   logGroup: (env) => `/aws/lambda/${projectFor(env)}-${env}-report`,            prefix: "REPORT   ", color: "\x1b[33m" }, // yellow
  { key: "reminder", logGroup: (env) => `/aws/lambda/${projectFor(env)}-${env}-reminder`,          prefix: "REMINDER ", color: "\x1b[32m" }, // green
];
const RESET = "\x1b[0m";

function parseArgs(argv) {
  const out = { env: "dev", since: "5m", only: undefined };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    switch (key) {
      case "--env":
      case "--since":
      case "--only":
        out[key.slice(2)] = argv[++i];
        break;
      case "--help":
      case "-h":
        out.help = true;
        break;
      default:
        throw new Error(`Unknown flag: ${key}`);
    }
  }
  return out;
}

function usage() {
  console.log(`Usage:
  pnpm dev:tail [--only <keyword>] [--since <duration>] [--env dev|production]

Flags:
  --only    substring match — keeps only groups whose key contains this string.
            keys: ingress, worker, report, reminder.
  --since   passed to \`aws logs tail --since\` (default 5m).
  --env     dev (default) or production.

Ctrl-C stops all tails.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const env = args.env ?? "dev";
  const region = process.env.AWS_REGION ?? "us-east-1";
  const groups = APPS.filter((a) => !args.only || a.key.includes(args.only));
  if (groups.length === 0) {
    throw new Error(`--only "${args.only}" matched no log groups.`);
  }

  console.log(
    `Tailing ${groups.length} log group(s) in ${region} (since ${args.since}). Ctrl-C to stop.`,
  );
  for (const g of groups) {
    console.log(`  ${g.color}${g.prefix}${RESET} ${g.logGroup(env)}`);
  }
  console.log("");

  const children = groups.map((g) => {
    const proc = spawn(
      "aws",
      [
        "logs",
        "tail",
        g.logGroup(env),
        "--follow",
        "--since",
        args.since,
        "--region",
        region,
        "--format",
        "short",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    for (const stream of [proc.stdout, proc.stderr]) {
      let buffer = "";
      stream.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.length === 0) continue;
          process.stdout.write(`${g.color}${g.prefix}${RESET} ${line}\n`);
        }
      });
    }
    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        process.stderr.write(
          `${g.color}${g.prefix}${RESET} aws logs tail exited with code ${code}\n`,
        );
      }
    });
    return proc;
  });

  const shutdown = () => {
    for (const c of children) c.kill("SIGINT");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await new Promise(() => {}); // keep alive until signal
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
