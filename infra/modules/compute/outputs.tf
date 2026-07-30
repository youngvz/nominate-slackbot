output "slack_ingress_function_name" {
  description = "Slack ingress Lambda function name."
  value       = aws_lambda_function.function["slack_ingress"].function_name
}

output "slack_ingress_function_arn" {
  description = "Slack ingress Lambda ARN."
  value       = aws_lambda_function.function["slack_ingress"].arn
}

output "slack_ingress_invoke_arn" {
  description = "Slack ingress Lambda invoke ARN (for API Gateway integration)."
  value       = aws_lambda_function.function["slack_ingress"].invoke_arn
}

output "nomination_worker_function_name" {
  description = "Nomination worker Lambda function name."
  value       = aws_lambda_function.function["nomination_worker"].function_name
}

output "nomination_worker_function_arn" {
  description = "Nomination worker Lambda ARN."
  value       = aws_lambda_function.function["nomination_worker"].arn
}

output "reminder_function_arn" {
  description = "Weekly reminder Lambda ARN."
  value       = aws_lambda_function.function["reminder"].arn
}

output "reminder_function_name" {
  description = "Weekly reminder Lambda function name."
  value       = aws_lambda_function.function["reminder"].function_name
}

output "report_function_arn" {
  description = "Biweekly report Lambda ARN."
  value       = aws_lambda_function.function["report"].arn
}

output "report_function_name" {
  description = "Biweekly report Lambda function name."
  value       = aws_lambda_function.function["report"].function_name
}
