locals {
  name_prefix   = "${var.project}-${var.environment}"
  alarm_actions = var.alarm_topic_arn == "" ? [] : [var.alarm_topic_arn]
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${each.value}-errors"
  alarm_description   = "Lambda ${each.value} errors detected."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_duration_p99" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${each.value}-duration-p99"
  alarm_description   = "Lambda ${each.value} p99 duration exceeded threshold."
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  extended_statistic  = "p99"
  period              = 60
  evaluation_periods  = 5
  threshold           = var.duration_p99_threshold_ms
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${each.value}-throttles"
  alarm_description   = "Lambda ${each.value} throttles detected."
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = each.value
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "${local.name_prefix}-nomination-dlq-depth"
  alarm_description   = "Nomination DLQ has messages waiting."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  threshold           = var.dlq_depth_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = var.dlq_name
  }

  alarm_actions = local.alarm_actions
  ok_actions    = local.alarm_actions
  tags          = var.tags
}

resource "aws_cloudwatch_dashboard" "main" {
  count          = var.create_dashboard ? 1 : 0
  dashboard_name = "${local.name_prefix}-overview"
  dashboard_body = jsonencode({
    widgets = concat(
      [
        {
          type   = "metric"
          x      = 0
          y      = 0
          width  = 12
          height = 6
          properties = {
            title  = "Nomination queue depth"
            region = data.aws_region.current.name
            stat   = "Maximum"
            period = 60
            metrics = [
              ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.queue_name],
              ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.dlq_name],
            ]
          }
        },
      ],
      [
        for idx, fn in var.lambda_function_names : {
          type   = "metric"
          x      = (idx % 2) * 12
          y      = 6 + floor(idx / 2) * 6
          width  = 12
          height = 6
          properties = {
            title  = "${fn} — invocations / errors"
            region = data.aws_region.current.name
            stat   = "Sum"
            period = 60
            metrics = [
              ["AWS/Lambda", "Invocations", "FunctionName", fn],
              [".", "Errors", ".", "."],
              [".", "Throttles", ".", "."],
            ]
          }
        }
      ]
    )
  })
}

data "aws_region" "current" {}
