#!/usr/bin/env node
// Bundles an app's src/index.ts into a single-file dist/lambda.js and zips it
// into dist/lambda.zip, ready for upload to the artifact S3 bucket.
//
// Usage:
//   node scripts/bundle-lambda.mjs <app-dir>
//
// The app dir is relative to CWD. Each app's package.json calls this with `.`
// (`node ../../scripts/bundle-lambda.mjs .`), so pnpm's per-package CWD scoping
// resolves it correctly.
//
// Runtime target = Node.js 20 (Lambda). @aws-sdk/* is marked external because
// AWS provides SDK v3 in the runtime layer — bundling it would waste 6+MB per
// function without changing behavior.

import { readFileSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { build } from "esbuild";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

const rawArg = process.argv[2];
if (!rawArg) {
  console.error("usage: bundle-lambda.mjs <app-dir>");
  process.exit(2);
}
const appDir = isAbsolute(rawArg) ? rawArg : resolve(process.cwd(), rawArg);

const pkgPath = join(appDir, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const displayName = pkg.name ?? appDir;

const entry = join(appDir, "src/index.ts");
const outDir = join(appDir, "dist");
const outFile = join(outDir, "lambda.js");
const zipPath = join(outDir, "lambda.zip");

console.log(`[${displayName}] bundling ${entry}`);
rmSync(outFile, { force: true });
rmSync(zipPath, { force: true });

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: outFile,
  sourcemap: false,
  minify: false,
  legalComments: "none",
  logLevel: "info",
  external: [
    // Provided by the AWS Lambda Node.js 20 runtime.
    "@aws-sdk/*",
    "aws-sdk",
  ],
  // Resolve workspace deps from the repo root's node_modules so pnpm's
  // symlinked packages are followed correctly.
  absWorkingDir: repoRoot,
});

const zip = new AdmZip();
zip.addLocalFile(outFile, "", "index.js");
zip.writeZip(zipPath);

console.log(`[${displayName}] wrote ${zipPath}`);
