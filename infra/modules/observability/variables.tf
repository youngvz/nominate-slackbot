variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "alarm_topic_arn" {
  description = "SNS topic to route alarms to. Empty disables alarm actions."
  type        = string
  default     = ""
}

variable "dlq_arn" {
  type = string
}

variable "dlq_name" {
  description = "Name of the DLQ (used as the CloudWatch dimension)."
  type        = string
}

variable "queue_url" {
  description = "Nomination queue URL (used only for dashboard widgets)."
  type        = string
  default     = ""
}

variable "queue_name" {
  description = "Nomination queue name (used as the dashboard CloudWatch dimension)."
  type        = string
  default     = ""
}

variable "lambda_function_names" {
  description = "Function names to attach error/duration/throttle alarms to."
  type        = list(string)
  default     = []
}

variable "duration_p99_threshold_ms" {
  description = "Alarm when p99 duration exceeds this many milliseconds."
  type        = number
  default     = 5000
}

variable "dlq_depth_threshold" {
  description = "Alarm when DLQ ApproximateNumberOfMessagesVisible exceeds this."
  type        = number
  default     = 0
}

variable "create_dashboard" {
  type    = bool
  default = false
}

variable "tags" {
  type    = map(string)
  default = {}
}
