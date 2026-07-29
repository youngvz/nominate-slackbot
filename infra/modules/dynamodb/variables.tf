variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "table_name" {
  description = "Fully qualified table name. Example {project}-{environment}-app."
  type        = string
}

variable "gsi1_name" {
  type    = string
  default = "GSI1"
}

variable "ttl_attribute" {
  type    = string
  default = "ttl"
}

variable "enable_pitr" {
  type    = bool
  default = true
}

variable "enable_scheduled_export" {
  type    = bool
  default = false
}

variable "archive_bucket_arn" {
  description = "Required when enable_scheduled_export = true."
  type        = string
  default     = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}
