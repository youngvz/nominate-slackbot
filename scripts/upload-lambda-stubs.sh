#!/usr/bin/env bash
# Uploads a hello-world Lambda zip to every S3 key the compute module expects,
# so `terraform apply` can create the four Lambda functions before real
# application code has been built. Intended for first stand-up of a fresh
# environment; the real build pipeline overwrites these keys later.
#
# Usage:
#   bash scripts/upload-lambda-stubs.sh dev
#   bash scripts/upload-lambda-stubs.sh production
#
# Idempotent: re-running overwrites the stub objects with a fresh copy.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <dev|production>" >&2
  exit 2
fi

ENV="$1"
case "$ENV" in
  dev|production) ;;
  *)
    echo "error: environment must be 'dev' or 'production' (got '${ENV}')" >&2
    exit 2
    ;;
esac

PROJECT="${PROJECT:-nominate-slackbot}"

for cmd in aws zip; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: $cmd is required" >&2
    exit 2
  fi
done

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${ARTIFACT_BUCKET:-${PROJECT}-${ENV}-artifacts-${ACCOUNT_ID}}"

if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "error: artifact bucket '${BUCKET}' does not exist. Run bootstrap-artifacts.sh first." >&2
  exit 2
fi

echo ">> Bucket: ${BUCKET}"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

cat > "$TMPDIR/index.js" <<'EOF'
// Stub handler. Overwritten by the real build pipeline before Phase 1 launch.
exports.handler = async (event) => {
  console.log(JSON.stringify({ msg: "stub_handler_invoked", event }));
  return { statusCode: 200, body: "stub" };
};
EOF

(cd "$TMPDIR" && zip -q stub.zip index.js)

FUNCTIONS=(slack-ingress nomination-worker reminder report)
for fn in "${FUNCTIONS[@]}"; do
  KEY="${PROJECT}-${ENV}-${fn}.zip"
  echo ">> Uploading s3://${BUCKET}/${KEY}"
  aws s3 cp --quiet "$TMPDIR/stub.zip" "s3://${BUCKET}/${KEY}"
done

echo
echo "Done. Four stub artifacts uploaded to ${BUCKET}."
