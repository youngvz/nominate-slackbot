output "reminder_schedule_arn" {
  description = "Weekly reminder EventBridge Scheduler ARN."
  value       = aws_scheduler_schedule.reminder.arn
}

output "report_schedule_arn" {
  description = "Biweekly report EventBridge Scheduler ARN."
  value       = aws_scheduler_schedule.report.arn
}
