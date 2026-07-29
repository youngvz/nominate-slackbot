#!/usr/bin/env bash
# Runs the checks required by docs/08-terraform-standards.md §Validation:
#   terraform fmt -check -recursive
#   terraform init -backend=false
#   terraform validate
# across every environment and module.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Share a single provider download across every module/environment. Without
# this, `terraform init` copies the ~650MB aws provider into every directory.
export TF_PLUGIN_CACHE_DIR="${TF_PLUGIN_CACHE_DIR:-$HOME/.terraform.d/plugin-cache}"
mkdir -p "$TF_PLUGIN_CACHE_DIR"

terraform fmt -check -recursive infra

for dir in infra/environments/* infra/modules/*; do
  [ -d "$dir" ] || continue
  echo ">> $dir"
  (
    cd "$dir"
    terraform init -backend=false -input=false >/dev/null
    terraform validate
  )
done
