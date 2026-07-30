variable "project" {
  description = "Project prefix (see docs/08-terraform-standards.md §Naming)."
  type        = string
}

variable "environment" {
  description = "Environment name (dev | production)."
  type        = string
}

variable "ingress_lambda_invoke_arn" {
  description = "Invoke ARN of the Slack ingress Lambda (from module.compute)."
  type        = string
}

variable "ingress_lambda_function_arn" {
  description = "Function ARN of the Slack ingress Lambda (used to scope the API GW invoke permission)."
  type        = string
}

variable "tags" {
  description = "Required tags per docs/08 §Required tags."
  type        = map(string)
  default     = {}
}
