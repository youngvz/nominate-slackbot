terraform {
  backend "s3" {
    # Configure via `terraform init -backend-config=...` or a backend config file.
    # docs/08-terraform-standards.md §State: S3 backend, versioning, native S3
    # lockfile mechanism, encryption at rest, separate state keys per env.
    #
    # bucket       = "<company>-tfstate"
    # key          = "nominate-slackbot/production/terraform.tfstate"
    # region       = "us-east-1"
    # encrypt      = true
    # use_lockfile = true
  }
}
