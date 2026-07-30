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
  default = "production"
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

variable "report_workspace_id" {
  description = "Slack workspace ID (T…) the scheduled report Lambda targets when EventBridge fires with an empty payload (docs/10 §Scheduled input contract). Required for the scheduled biweekly report."
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
  default     = true
}

variable "force_destroy" {
  description = "Allow terraform destroy of a non-empty S3 archive bucket. Must remain false in production."
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention for Lambda log groups."
  type        = number
  default     = 30
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
