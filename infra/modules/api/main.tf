resource "aws_apigatewayv2_api" "slack" {
  name          = "${var.project}-${var.environment}-slack"
  protocol_type = "HTTP"
  description   = "Slack ingress HTTP API for ${var.project} ${var.environment}."
  tags          = var.tags
}

resource "aws_apigatewayv2_integration" "slack_ingress" {
  api_id                 = aws_apigatewayv2_api.slack.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = var.ingress_lambda_invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "slack_events" {
  api_id    = aws_apigatewayv2_api.slack.id
  route_key = "POST /slack/events"
  target    = "integrations/${aws_apigatewayv2_integration.slack_ingress.id}"
}

#tfsec:ignore:aws-cloudwatch-log-group-customer-key AWS-managed SSE is sufficient; access-log payloads are metadata-only (no request/response bodies)
resource "aws_cloudwatch_log_group" "access" {
  name              = "/aws/apigateway/${var.project}-${var.environment}-slack"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.slack.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      integrationErr = "$context.integrationErrorMessage"
      sourceIp       = "$context.identity.sourceIp"
    })
  }

  tags = var.tags
}

resource "aws_lambda_permission" "api_invoke_ingress" {
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.ingress_lambda_function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.slack.execution_arn}/*/*/slack/events"
}
