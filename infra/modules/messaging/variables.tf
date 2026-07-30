variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "visibility_timeout_seconds" {
  description = "Must exceed Lambda timeout plus retry buffer (docs/06 §SQS behavior)."
  type        = number
  default     = 90
}

variable "max_receive_count" {
  description = "Deliveries per message before it lands in the DLQ."
  type        = number
  default     = 5
}

variable "message_retention_seconds" {
  description = "Time SQS keeps messages before dropping them (seconds)."
  type        = number
  default     = 345600
}

variable "tags" {
  type    = map(string)
  default = {}
}
