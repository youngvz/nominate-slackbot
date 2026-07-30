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

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.slack.id
  name        = "$default"
  auto_deploy = true
  tags        = var.tags
}

resource "aws_lambda_permission" "api_invoke_ingress" {
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = var.ingress_lambda_function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.slack.execution_arn}/*/*/slack/events"
}
