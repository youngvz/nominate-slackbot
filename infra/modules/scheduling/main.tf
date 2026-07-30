locals {
  name_prefix = "${var.project}-${var.environment}"

  targets = {
    reminder = {
      name          = "${local.name_prefix}-reminder"
      target_arn    = var.reminder_target_arn
      first_run_at  = var.reminder_first_run_at
      schedule_expr = "cron(0 9 ? * FRI *)"
    }
    report = {
      name          = "${local.name_prefix}-report"
      target_arn    = var.report_target_arn
      first_run_at  = var.report_first_run_at
      schedule_expr = "rate(14 days)"
    }
  }
}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  for_each           = local.targets
  name               = "${each.value.name}-scheduler-role"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
  tags               = var.tags
}

data "aws_iam_policy_document" "invoke_target" {
  for_each = local.targets
  statement {
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [each.value.target_arn]
  }
}

resource "aws_iam_role_policy" "invoke_target" {
  for_each = local.targets
  name     = "invoke"
  role     = aws_iam_role.scheduler[each.key].id
  policy   = data.aws_iam_policy_document.invoke_target[each.key].json
}

# Note: EventBridge Scheduler dead-letter target is out of scope for this slice
# (see task follow-ups). Alarms in the observability module cover invocation
# failures indirectly via Lambda errors and DLQ depth.

resource "aws_scheduler_schedule" "reminder" {
  name                         = local.targets.reminder.name
  schedule_expression          = local.targets.reminder.schedule_expr
  schedule_expression_timezone = var.timezone
  start_date                   = local.targets.reminder.first_run_at

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = local.targets.reminder.target_arn
    role_arn = aws_iam_role.scheduler["reminder"].arn
  }
}

resource "aws_scheduler_schedule" "report" {
  name                         = local.targets.report.name
  schedule_expression          = local.targets.report.schedule_expr
  schedule_expression_timezone = var.timezone
  start_date                   = local.targets.report.first_run_at

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = local.targets.report.target_arn
    role_arn = aws_iam_role.scheduler["report"].arn
  }
}
