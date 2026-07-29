variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "timezone" {
  type    = string
  default = "America/New_York"
}

variable "reminder_target_arn" {
  type = string
}

variable "report_target_arn" {
  type = string
}

variable "reminder_first_run_at" {
  description = "ISO-8601 first-run anchor for the weekly reminder."
  type        = string
  default     = "2026-08-07T09:00:00"
}

variable "report_first_run_at" {
  description = "ISO-8601 first-run anchor for the biweekly report."
  type        = string
  default     = "2026-08-14T12:00:00"
}

variable "tags" {
  type    = map(string)
  default = {}
}
