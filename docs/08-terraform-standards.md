# Terraform Standards

## Repository structure

```text
infra/
  modules/
    api/
    compute/
    dynamodb/
    messaging/
    scheduling/
    secrets/
    observability/
    archive/
  environments/
    dev/
    production/
```

Environment roots compose reusable modules. Do not create one copied Terraform stack per environment.

## State

- Use an S3 backend.
- Enable S3 versioning.
- Use the supported S3 lockfile mechanism for state locking.
- Encrypt state at rest.
- Restrict state access because state may contain sensitive metadata.
- Use separate state keys per environment.

The state bucket is provisioned out-of-band by `scripts/bootstrap-tfstate.sh` (also `pnpm infra:bootstrap`), not by Terraform. Keeping it out of the app stack means `terraform destroy` can never wipe the state it's operating on, and there's no chicken-and-egg where the state bucket needs its own separate state file.

`backend.tf` in each environment is a partial configuration — the resource block is empty. Real values (bucket, key, region, and encryption) live in `backend.hcl` next to it. `backend.hcl` is gitignored per `docs/09` §Open-source controls (it contains the AWS account ID); only `backend.hcl.example` is tracked.

Initialize an environment with:

```bash
cd infra/environments/dev
terraform init -backend-config=backend.hcl
```

`scripts/infra-destroy.sh` passes `-backend-config=backend.hcl` automatically and errors out if the file is missing.

Do not store Slack secret values directly in Terraform variables or committed tfvars. Terraform may provision secret containers and permissions, while secret values are populated through an approved secure process.

## Artifact bucket

Lambda deployment zips live in an S3 bucket that is also bootstrapped out-of-band, one per environment (`scripts/bootstrap-artifacts.sh <env>`, or `pnpm infra:artifacts <env>`). The bucket name follows the naming convention `{project}-{environment}-artifacts-{account}` and is passed into Terraform via the `artifact_bucket` variable. Because `aws_lambda_function` resolves the S3 object at plan time, a fresh environment needs at least one zip per function present in the bucket before the first `terraform apply`. `scripts/upload-lambda-stubs.sh <env>` (or `pnpm infra:stub-lambdas <env>`) uploads a hello-world zip to each of the four expected keys; the real build pipeline overwrites them later.

## Naming

Use a consistent prefix:

```text
{project}-{environment}-{resource-purpose}
```

Resource names should be stable, lowercase where required, and avoid personal names.

## Required tags

- `Project`
- `Environment`
- `ManagedBy=Terraform`
- `Owner`
- `CostCenter` when available
- `DataClassification` where appropriate

## Module standards

Each module should include:

- `main.tf`
- `variables.tf`
- `outputs.tf`
- `versions.tf`
- `README.md`

Modules should expose meaningful inputs rather than entire provider resource objects.

## Environment configuration

Company-specific values such as the recognition channel ID and maintainer Slack IDs belong in noncommitted environment configuration or deployment secrets.

Commit example files:

```text
terraform.tfvars.example
.env.example
```

Never commit production values.

## Validation

CI must run:

```bash
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

Add security and policy scanning according to repository tooling.

## Apply workflow

- Pull requests generate plans for review.
- Production applies require explicit approval.
- Apply the exact reviewed plan artifact when supported.
- Manual console changes are prohibited except emergency remediation.
- Any emergency change must be imported or reconciled immediately afterward.

## Versioning

Pin Terraform and provider versions using compatible constraints. Upgrade intentionally and document breaking changes.
