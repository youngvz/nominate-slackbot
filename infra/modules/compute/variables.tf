variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "nodejs_runtime" {
  description = "Node.js Lambda runtime, e.g. nodejs20.x."
  type        = string
  default     = "nodejs20.x"
}

variable "architecture" {
  description = "Lambda architecture. Prefer arm64 after testing (docs/07)."
  type        = string
  default     = "arm64"
}

variable "artifact_bucket" {
  description = "S3 bucket containing versioned Lambda deployment artifacts."
  type        = string
}

variable "dynamodb_table_name" {
  type = string
}

variable "dynamodb_table_arn" {
  type = string
}

variable "nomination_queue_url" {
  type = string
}

variable "nomination_queue_arn" {
  type = string
}

variable "slack_signing_secret_arn" {
  type = string
}

variable "slack_bot_token_arn" {
  type = string
}

variable "recognition_channel_id" {
  type = string
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "tags" {
  type    = map(string)
  default = {}
}
