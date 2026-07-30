# ADR-006: Terraform state and artifact buckets are managed out-of-band

## Status

Accepted.

## Decision

Two S3 buckets that Terraform depends on — the Terraform state bucket and the per-environment Lambda artifact bucket — are provisioned by shell scripts (`scripts/bootstrap-tfstate.sh`, `scripts/bootstrap-artifacts.sh`), not by the Terraform stacks in `infra/environments/*`. Real backend configuration values (bucket name, key, region) live in a gitignored `backend.hcl` next to each environment's partial `backend.tf`; only `backend.hcl.example` is tracked.

## Rationale

- **The state bucket cannot be inside its own Terraform stack.** Storing the state bucket's state locally would make it a per-operator artifact; storing it remotely would depend on the bucket it defines. Every workable alternative reintroduces the chicken-and-egg somewhere.
- **`terraform destroy` on the app stack must never touch the state bucket.** Managing it in the app stack would require a `prevent_destroy = true` lifecycle block — explicitly disallowed by the project's CLAUDE.md — or a second Terraform stack whose only job is to protect the bucket from the first stack.
- **The artifact bucket has to exist before the first `terraform apply`.** `aws_lambda_function` validates the S3 object at plan time, so the bucket and the four function zips both need to be present before Terraform runs. Making Terraform own the bucket would force a two-phase apply (create bucket → upload artifacts → apply Lambdas) or a data-source workaround.
- **AWS account IDs must not appear in the public repo** per `docs/09` §Open-source controls. Backend values include the account ID (bucket names embed it), so committing them directly to `backend.tf` violates that policy. A partial-backend + gitignored `backend.hcl` keeps public files placeholder-only.

## Consequences

- Fresh environments require a documented setup sequence (`docs/14` §First stand-up): bootstrap state bucket → wire backend → bootstrap artifact bucket → upload stub zips → tfvars → `terraform init -backend-config=backend.hcl` → plan → apply.
- The bootstrap scripts must be idempotent so operators can re-run them without side effects (all three currently are).
- `scripts/infra-destroy.sh` cannot delete the state bucket, which is desired: destroying an environment leaves the state file behind so a subsequent re-provision uses the same state.
- Adding a new environment requires running both bootstrap scripts before Terraform can touch that env.
- Rotating account IDs (unusual, but possible under org migrations) requires updating `backend.hcl` and re-running `terraform init` in every env root — the `backend.tf` stays unchanged.

## Alternatives considered

1. **Terraform-managed state bucket in a separate `infra/bootstrap` stack.** Rejected: adds a second Terraform stack with either local state (unshared) or its own remote state (recursion). More moving parts than a 30-line CLI script.
2. **`prevent_destroy = true` on the state bucket resource.** Rejected: contradicts the CLAUDE.md rule against `prevent_destroy` and against masking the intent of `terraform destroy`.
3. **Committing real backend values in `backend.tf`.** Rejected: violates `docs/09` §Open-source controls (account IDs must be placeholders in the public repo).
