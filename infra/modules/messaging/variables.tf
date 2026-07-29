variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "worker_function_arn" {
  type = string
}

variable "visibility_timeout_seconds" {
  description = "Must exceed Lambda timeout plus retry buffer (docs/06 §SQS behavior)."
  type        = number
  default     = 90
}

variable "batch_size" {
  description = "Keep small unless load testing supports larger (docs/06 §SQS behavior)."
  type        = number
  default     = 5
}

variable "max_receive_count" {
  type    = number
  default = 5
}

variable "tags" {
  type    = map(string)
  default = {}
}
