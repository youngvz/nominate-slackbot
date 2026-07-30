output "signing_secret_arn" {
  description = "ARN of the Slack signing secret."
  value       = aws_secretsmanager_secret.signing_secret.arn
}

output "bot_token_arn" {
  description = "ARN of the Slack bot token."
  value       = aws_secretsmanager_secret.bot_token.arn
}
