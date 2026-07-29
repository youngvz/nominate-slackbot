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
