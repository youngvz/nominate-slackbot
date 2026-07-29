output "slack_request_url" {
  description = "Public URL used as the Slack app's Request URL."
  value       = module.api.invoke_url
}

output "dynamodb_table_name" {
  value = module.dynamodb.table_name
}

output "nomination_queue_url" {
  value = module.messaging.queue_url
}
