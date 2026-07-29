variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "alarm_topic_arn" {
  description = "SNS topic to route alarms to."
  type        = string
  default     = ""
}

variable "dlq_arn" {
  type = string
}

variable "queue_url" {
  type = string
}

variable "lambda_function_names" {
  description = "Function names to attach error/duration/throttle alarms to."
  type        = list(string)
  default     = []
}

variable "create_dashboard" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}
