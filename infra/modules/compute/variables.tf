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

variable "artifact_object_keys" {
  description = "Optional per-function S3 keys. Missing keys fall back to {function-name}.zip."
  type = object({
    slack_ingress     = optional(string)
    nomination_worker = optional(string)
    reminder          = optional(string)
    report            = optional(string)
  })
  default = {}
}

variable "dynamodb_table_name" {
  type = string
}

variable "dynamodb_table_arn" {
  type = string
}

variable "dynamodb_gsi1_arn" {
  description = "ARN of the reporting GSI, needed by the worker and report roles."
  type        = string
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

variable "slack_maintainer_ids" {
  description = "Comma-separated Slack user IDs allowed to invoke /kudos-admin (docs/02 §Maintainer authorization)."
  type        = string
  default     = ""
}

variable "report_workspace_id" {
  description = "Slack workspace ID the scheduled report Lambda targets when EventBridge fires with an empty payload (docs/10 §Scheduled input contract). Empty string omits the env var; admin invocations still supply workspaceId explicitly."
  type        = string
  default     = ""
}

variable "program_timezone" {
  description = "IANA timezone used for program-facing scheduling."
  type        = string
  default     = "America/New_York"
}

variable "program_start_at" {
  description = "ISO-8601 program start timestamp with fixed offset (docs/10)."
  type        = string
  default     = "2026-07-31T00:00:00-04:00"
}

variable "first_report_at" {
  description = "Optional dev override for the first-report anchor. Empty string keeps the domain default (docs/10). Production must leave this empty."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "sqs_batch_size" {
  description = "SQS to worker batch size (docs/06 §SQS behavior)."
  type        = number
  default     = 5
}

variable "worker_timeout_seconds" {
  description = "Worker Lambda timeout. Visibility timeout must exceed this."
  type        = number
  default     = 30
}

variable "default_timeout_seconds" {
  description = "Default timeout for the ingress, reminder, and report functions."
  type        = number
  default     = 10
}

variable "tags" {
  type    = map(string)
  default = {}
}
