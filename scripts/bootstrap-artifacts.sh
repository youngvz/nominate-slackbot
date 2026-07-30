#!/usr/bin/env bash
# Creates the S3 bucket that holds Lambda deployment artifacts for a single
# environment. The bucket is deliberately not managed by Terraform so that
# `terraform apply` never depends on its own artifacts existing yet — the
# compute module points at objects inside this bucket and expects them at
# plan time.
#
# Usage:
#   bash scripts/bootstrap-artifacts.sh dev
#   bash scripts/bootstrap-artifacts.sh production
#
# Idempotent: re-running against an existing bucket reconciles versioning,
# encryption, and public access settings.
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
REGION="${REGION:-us-east-1}"

if ! command -v aws >/dev/null 2>&1; then
  echo "error: aws CLI is required" >&2
  exit 2
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${PROJECT}-${ENV}-artifacts-${ACCOUNT_ID}"

echo ">> Account:  ${ACCOUNT_ID}"
echo ">> Region:   ${REGION}"
echo ">> Bucket:   ${BUCKET}"

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

echo ">> Enabling versioning (Lambda pinning by S3 object version)."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

echo ">> Enabling default encryption (AES256)."
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

echo ">> Blocking public access."
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

echo
echo "Done. Set the following in infra/environments/${ENV}/terraform.tfvars:"
echo
echo "  artifact_bucket = \"${BUCKET}\""
