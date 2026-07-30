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
  description = "RFC3339 first-run anchor for the weekly reminder. Must include a timezone offset (aws_scheduler_schedule requires it even when schedule_expression_timezone is set)."
  type        = string
  default     = "2026-08-07T09:00:00-04:00"
}

variable "report_first_run_at" {
  description = "RFC3339 first-run anchor for the biweekly report. See reminder_first_run_at for the offset requirement."
  type        = string
  default     = "2026-08-14T12:00:00-04:00"
}

variable "tags" {
  type    = map(string)
  default = {}
}
