#!/usr/bin/env bash
# Uploads each app's dist/lambda.zip to the environment's artifact S3 bucket
# and calls aws lambda update-function-code so the running Lambda picks up the
# new code without a terraform re-apply.
#
# Usage:
#   pnpm build:lambda                          # build all four zips first
#   bash scripts/upload-lambdas.sh dev         # or `pnpm infra:upload-lambdas dev`
#
# Idempotent: re-running overwrites the S3 objects and re-issues update-function-code.
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

if ! command -v aws >/dev/null 2>&1; then
  echo "error: aws CLI is required" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${ARTIFACT_BUCKET:-${PROJECT}-${ENV}-artifacts-${ACCOUNT_ID}}"

if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "error: artifact bucket '${BUCKET}' does not exist. Run bootstrap-artifacts.sh first." >&2
  exit 2
fi

echo ">> Bucket: ${BUCKET}"

# Map of terraform function slug → app package directory.
FUNCTIONS=(
  "slack-ingress:apps/slack-ingress"
  "nomination-worker:apps/nomination-worker"
  "reminder:apps/reminder-job"
  "report:apps/report-job"
)

for entry in "${FUNCTIONS[@]}"; do
  SLUG="${entry%%:*}"
  APP_DIR="${entry##*:}"
  ZIP="${ROOT}/${APP_DIR}/dist/lambda.zip"
  FUNCTION_NAME="${PROJECT}-${ENV}-${SLUG}"
  S3_KEY="${FUNCTION_NAME}.zip"

  if [ ! -f "$ZIP" ]; then
    echo "error: ${ZIP} missing. Run \`pnpm build:lambda\` first." >&2
    exit 2
  fi

  echo ">> Uploading ${APP_DIR} -> s3://${BUCKET}/${S3_KEY}"
  aws s3 cp --quiet "$ZIP" "s3://${BUCKET}/${S3_KEY}"

  echo ">> Updating function ${FUNCTION_NAME}"
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --s3-bucket "$BUCKET" \
    --s3-key "$S3_KEY" \
    --publish \
    --output text \
    --query '{Function:FunctionName,Version:Version,CodeSize:CodeSize,LastModified:LastModified}'
done

echo
echo "Done. Four Lambdas updated in ${ENV}."
