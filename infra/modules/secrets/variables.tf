variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "kms_key_arn" {
  type    = string
  default = ""
}

variable "recovery_window_in_days" {
  description = "Secrets Manager soft-delete window. Set to 0 in dev so teardown can re-apply immediately; keep the default in production."
  type        = number
  default     = 30

  validation {
    condition     = var.recovery_window_in_days == 0 || (var.recovery_window_in_days >= 7 && var.recovery_window_in_days <= 30)
    error_message = "recovery_window_in_days must be 0 (force delete) or between 7 and 30."
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}
