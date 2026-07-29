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
    staging/
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

Do not store Slack secret values directly in Terraform variables or committed tfvars. Terraform may provision secret containers and permissions, while secret values are populated through an approved secure process.

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
