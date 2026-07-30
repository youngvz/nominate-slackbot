output "dashboard_arn" {
  description = "CloudWatch dashboard ARN when create_dashboard = true."
  value       = var.create_dashboard ? aws_cloudwatch_dashboard.main[0].dashboard_arn : null
}

output "alarm_arns" {
  description = "ARNs of every alarm created by this module."
  value = concat(
    [for a in aws_cloudwatch_metric_alarm.lambda_errors : a.arn],
    [for a in aws_cloudwatch_metric_alarm.lambda_duration_p99 : a.arn],
    [for a in aws_cloudwatch_metric_alarm.lambda_throttles : a.arn],
    [aws_cloudwatch_metric_alarm.dlq_depth.arn],
  )
}
