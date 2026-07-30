#!/usr/bin/env bash
# One-shot bootstrap of the S3 bucket that holds Terraform state.
#
# The state bucket is deliberately out of Terraform's own management so that
# `pnpm infra:destroy` can never wipe the state it's operating on. Run once
# per AWS account. Idempotent — re-running against an existing bucket is a
# no-op that reconciles versioning/encryption/lifecycle settings.
#
# Usage:
#   bash scripts/bootstrap-tfstate.sh
#   REGION=us-west-2 bash scripts/bootstrap-tfstate.sh
#   PROJECT=other-app bash scripts/bootstrap-tfstate.sh
set -euo pipefail

PROJECT="${PROJECT:-nominate-slackbot}"
REGION="${REGION:-us-east-1}"

for cmd in aws jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: $cmd is required" >&2
    exit 2
  fi
done

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${PROJECT}-tfstate-${ACCOUNT_ID}"

echo ">> Account:  ${ACCOUNT_ID}"
echo ">> Region:   ${REGION}"
echo ">> Bucket:   ${BUCKET}"

# 1. Create bucket. us-east-1 must NOT be sent a LocationConstraint; every
# other region must be. head-bucket 0 → already exists (idempotent path).
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo ">> Bucket already exists — reconciling configuration."
else
  echo ">> Creating bucket."
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
fi

# 2. Versioning — required by the S3 native lockfile mechanism.
echo ">> Enabling versioning."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

# 3. Default encryption at rest (SSE-S3). Bump to SSE-KMS out-of-band if the
# organization requires a customer-managed key.
echo ">> Enabling default encryption (AES256)."
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# 4. Block every form of public access.
echo ">> Blocking public access."
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 5. Deny non-TLS access.
echo ">> Applying TLS-only bucket policy."
POLICY="$(jq -n --arg bucket "$BUCKET" '{
  Version: "2012-10-17",
  Statement: [{
    Sid: "DenyInsecureTransport",
    Effect: "Deny",
    Principal: "*",
    Action: "s3:*",
    Resource: [
      "arn:aws:s3:::\($bucket)",
      "arn:aws:s3:::\($bucket)/*"
    ],
    Condition: { Bool: { "aws:SecureTransport": "false" } }
  }]
}')"
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$POLICY"

# 6. Expire noncurrent state versions after 90 days. Live state is kept
# forever; only superseded versions age out.
echo ">> Applying lifecycle rule (expire noncurrent versions after 90 days)."
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-noncurrent-state-versions",
      "Status": "Enabled",
      "Filter": {},
      "NoncurrentVersionExpiration": { "NoncurrentDays": 90 }
    }]
  }'

echo
echo "Done."
echo "Fill in each environment's backend.tf with:"
echo
echo "  bucket       = \"${BUCKET}\""
echo "  key          = \"${PROJECT}/<env>/terraform.tfstate\""
echo "  region       = \"${REGION}\""
echo "  encrypt      = true"
echo "  use_lockfile = true"
