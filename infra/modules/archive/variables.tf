variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "bucket_name" {
  type = string
}

variable "kms_key_arn" {
  type    = string
  default = ""
}

variable "lifecycle_expiration_days" {
  description = "Recommended three-year retention (docs/09 §Data retention)."
  type        = number
  default     = 1095
}

variable "authorized_role_arns" {
  description = "Roles permitted to access the archive bucket. All other principals are denied."
  type        = list(string)
  default     = []
}

variable "force_destroy" {
  description = "Allow terraform destroy to remove a non-empty bucket. Dev only."
  type        = bool
  default     = false
}

variable "tags" {
  type    = map(string)
  default = {}
}
