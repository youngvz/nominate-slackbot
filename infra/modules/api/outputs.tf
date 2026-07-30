output "invoke_url" {
  description = "Public URL for the Slack request URL."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "api_id" {
  description = "API Gateway HTTP API id."
  value       = aws_apigatewayv2_api.slack.id
}
