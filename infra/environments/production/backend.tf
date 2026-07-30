terraform {
  # Partial backend configuration. Real values (bucket, key) live in the
  # gitignored backend.hcl next to this file. Init with:
  #
  #   terraform init -backend-config=backend.hcl
  #
  # docs/08-terraform-standards.md §State; docs/09 §Open-source controls
  # (account IDs are not committed).
  backend "s3" {}
}
