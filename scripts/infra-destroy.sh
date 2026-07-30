#!/usr/bin/env bash
# Runs `terraform destroy` against a specified environment root.
#
# Usage:
#   bash scripts/infra-destroy.sh dev
#   bash scripts/infra-destroy.sh production --yes-really-production
#
# Dev is designed to be freely torn down. Production requires the explicit
# --yes-really-production flag as a guard rail. Every invocation prints
# `terraform plan -destroy` output first and pauses for interactive
# confirmation before running `terraform destroy`.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <dev|production> [--yes-really-production]" >&2
  exit 2
fi

ENV="$1"
CONFIRM_FLAG="${2:-}"

case "$ENV" in
  dev|production) ;;
  *)
    echo "error: environment must be 'dev' or 'production' (got '${ENV}')" >&2
    exit 2
    ;;
esac

if [ "$ENV" = "production" ] && [ "$CONFIRM_FLAG" != "--yes-really-production" ]; then
  echo "error: destroying production requires the literal flag --yes-really-production" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_DIR="$ROOT/infra/environments/$ENV"

if [ ! -d "$ENV_DIR" ]; then
  echo "error: environment directory not found: $ENV_DIR" >&2
  exit 2
fi

# Share a single provider download across every module/environment. Mirrors
# scripts/infra-validate.sh so `init` doesn't refetch the aws provider each run.
export TF_PLUGIN_CACHE_DIR="${TF_PLUGIN_CACHE_DIR:-$HOME/.terraform.d/plugin-cache}"
mkdir -p "$TF_PLUGIN_CACHE_DIR"

cd "$ENV_DIR"

echo ">> Initializing $ENV_DIR"
terraform init -input=false >/dev/null

echo ">> Planning destroy for $ENV"
terraform plan -destroy -input=false

echo
printf "Proceed with terraform destroy against '%s'? [y/N] " "$ENV"
read -r REPLY
case "$REPLY" in
  y|Y|yes|YES) ;;
  *)
    echo "Aborted."
    exit 0
    ;;
esac

terraform destroy -auto-approve -input=false
