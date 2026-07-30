output "table_name" {
  description = "DynamoDB table name."
  value       = aws_dynamodb_table.app.name
}

output "table_arn" {
  description = "DynamoDB table ARN."
  value       = aws_dynamodb_table.app.arn
}

output "gsi1_arn" {
  description = "ARN of the reporting GSI (see docs/05 §Reporting index)."
  value       = "${aws_dynamodb_table.app.arn}/index/${var.gsi1_name}"
}
