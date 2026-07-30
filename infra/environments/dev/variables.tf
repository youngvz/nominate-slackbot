variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "nominate-slackbot"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "recognition_channel_id" {
  description = "Slack channel ID for reminders/reports. Not committed (docs/09 §Open-source controls)."
  type        = string
}

variable "maintainer_slack_ids" {
  description = "Slack IDs of maintainers. Not committed (docs/09 §Open-source controls)."
  type        = list(string)
  default     = []
}

variable "program_start_at" {
  description = "Dev override for the program start (docs/10). Defaults to the real 2026-07-31 anchor; set to an earlier ISO-8601 timestamp to pull the first period back for pre-launch demos."
  type        = string
  default     = "2026-07-31T00:00:00-04:00"
}

variable "first_report_at" {
  description = "Dev override for the first-report anchor (docs/10). Empty string keeps the domain default; when overriding program_start_at for a demo, set this to program_start_at + 14 days at 12:00 local so the first period stays half-open."
  type        = string
  default     = ""
}

variable "report_workspace_id" {
  description = "Slack workspace ID (T…) the scheduled report Lambda targets when EventBridge fires with an empty payload (docs/10 §Scheduled input contract). Phase 1 is single-workspace so this is a single string."
  type        = string
  default     = ""
}

variable "artifact_bucket" {
  type = string
}

variable "owner" {
  type = string
}

variable "cost_center" {
  type    = string
  default = ""
}

variable "data_classification" {
  type    = string
  default = "Internal"
}

variable "enable_deletion_protection" {
  description = "Block terraform destroy of stateful resources (DynamoDB)."
  type        = bool
  default     = false
}

variable "force_destroy" {
  description = "Allow terraform destroy of a non-empty S3 archive bucket."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention for Lambda log groups."
  type        = number
  default     = 7
}

locals {
  tags = {
    Project            = var.project
    Environment        = var.environment
    ManagedBy          = "Terraform"
    Owner              = var.owner
    CostCenter         = var.cost_center
    DataClassification = var.data_classification
  }
}
