output "queue_url" {
  description = "Nomination SQS queue URL."
  value       = aws_sqs_queue.nomination.id
}

output "queue_arn" {
  description = "Nomination SQS queue ARN."
  value       = aws_sqs_queue.nomination.arn
}

output "queue_name" {
  description = "Nomination SQS queue name (used as the CloudWatch SQS dimension)."
  value       = aws_sqs_queue.nomination.name
}

output "dlq_url" {
  description = "Dead-letter queue URL."
  value       = aws_sqs_queue.nomination_dlq.id
}

output "dlq_arn" {
  description = "Dead-letter queue ARN."
  value       = aws_sqs_queue.nomination_dlq.arn
}

output "dlq_name" {
  description = "Dead-letter queue name (used as the CloudWatch SQS dimension)."
  value       = aws_sqs_queue.nomination_dlq.name
}
