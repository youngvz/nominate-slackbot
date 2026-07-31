locals {
  name_prefix          = "${var.project}-${var.environment}"
  report_function_name = "${local.name_prefix}-report"

  # Shared config injected into every Lambda. packages/configuration expects
  # this full set at cold start regardless of the function's role; scoping
  # environment variables per-Lambda used to trip loadEnv on ingress. The
  # secrets are still IAM-scoped per role, so a function that doesn't need a
  # given credential can't read it even though the ARN is present.
  #
  # REPORT_FUNCTION_NAME is read by the ingress Lambda's admin path
  # (docs/03 §Admin surface). Other roles ignore it, and IAM (below) limits
  # lambda:InvokeFunction on the report function to the ingress role.
  shared_env = merge(
    {
      SLACK_SIGNING_SECRET_ARN     = var.slack_signing_secret_arn
      SLACK_BOT_TOKEN_ARN          = var.slack_bot_token_arn
      SLACK_RECOGNITION_CHANNEL_ID = var.recognition_channel_id
      SLACK_MAINTAINER_IDS         = var.slack_maintainer_ids
      DYNAMODB_TABLE_NAME          = var.dynamodb_table_name
      NOMINATION_QUEUE_URL         = var.nomination_queue_url
      PROGRAM_TIMEZONE             = var.program_timezone
      PROGRAM_START_AT             = var.program_start_at
      REPORT_FUNCTION_NAME         = local.report_function_name
    },
    var.first_report_at == "" ? {} : { FIRST_REPORT_AT = var.first_report_at },
    var.report_workspace_id == "" ? {} : { REPORT_WORKSPACE_ID = var.report_workspace_id },
  )

  functions = {
    slack_ingress = {
      name        = "${local.name_prefix}-slack-ingress"
      artifact    = coalesce(try(var.artifact_object_keys.slack_ingress, null), "${local.name_prefix}-slack-ingress.zip")
      handler     = "dist/index.handler"
      timeout     = var.default_timeout_seconds
      memory_size = 256
      env         = local.shared_env
    }
    nomination_worker = {
      name        = "${local.name_prefix}-nomination-worker"
      artifact    = coalesce(try(var.artifact_object_keys.nomination_worker, null), "${local.name_prefix}-nomination-worker.zip")
      handler     = "dist/index.handler"
      timeout     = var.worker_timeout_seconds
      memory_size = 512
      env         = local.shared_env
    }
    reminder = {
      name        = "${local.name_prefix}-reminder"
      artifact    = coalesce(try(var.artifact_object_keys.reminder, null), "${local.name_prefix}-reminder.zip")
      handler     = "dist/index.handler"
      timeout     = var.default_timeout_seconds
      memory_size = 256
      env         = local.shared_env
    }
    report = {
      name        = "${local.name_prefix}-report"
      artifact    = coalesce(try(var.artifact_object_keys.report, null), "${local.name_prefix}-report.zip")
      handler     = "dist/index.handler"
      timeout     = var.default_timeout_seconds
      memory_size = 512
      env         = local.shared_env
    }
  }
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "function" {
  for_each           = local.functions
  name               = "${each.value.name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
  tags               = var.tags
}

#tfsec:ignore:aws-cloudwatch-log-group-customer-key AWS-managed SSE is sufficient; docs/09 prohibits logging secrets or descriptions so payloads are ID-only
resource "aws_cloudwatch_log_group" "function" {
  for_each          = local.functions
  name              = "/aws/lambda/${each.value.name}"
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

data "aws_iam_policy_document" "logs" {
  for_each = local.functions
  statement {
    effect    = "Allow"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.function[each.key].arn}:*"]
  }
}

resource "aws_iam_role_policy" "logs" {
  for_each = local.functions
  name     = "logs"
  role     = aws_iam_role.function[each.key].id
  policy   = data.aws_iam_policy_document.logs[each.key].json
}

data "aws_iam_policy_document" "xray" {
  statement {
    effect = "Allow"
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "xray" {
  for_each = local.functions
  name     = "xray"
  role     = aws_iam_role.function[each.key].id
  policy   = data.aws_iam_policy_document.xray.json
}

# --- Per-function scoped IAM policies -----------------------------------------

data "aws_iam_policy_document" "slack_ingress" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.slack_signing_secret_arn, var.slack_bot_token_arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [var.nomination_queue_arn]
  }

  # Read-only DynamoDB access for pre-flight repeat-window and prior-recognition
  # lookups on view_submission and slash-command paths. Writes still happen
  # exclusively on the worker Lambda (docs/04 §Nomination worker Lambda).
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
    ]
    resources = [var.dynamodb_table_arn, var.dynamodb_gsi1_arn]
  }

  # /kudos-admin report path (docs/03 §Admin surface). Scoped to the report
  # function only — the ingress never invokes any other Lambda.
  statement {
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.function["report"].arn]
  }
}

resource "aws_iam_role_policy" "slack_ingress" {
  name   = "app"
  role   = aws_iam_role.function["slack_ingress"].id
  policy = data.aws_iam_policy_document.slack_ingress.json
}

data "aws_iam_policy_document" "nomination_worker" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.slack_bot_token_arn]
  }

  statement {
    effect = "Allow"
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:ChangeMessageVisibility",
    ]
    resources = [var.nomination_queue_arn]
  }

  statement {
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:TransactWriteItems",
    ]
    resources = [var.dynamodb_table_arn, var.dynamodb_gsi1_arn]
  }
}

resource "aws_iam_role_policy" "nomination_worker" {
  name   = "app"
  role   = aws_iam_role.function["nomination_worker"].id
  policy = data.aws_iam_policy_document.nomination_worker.json
}

data "aws_iam_policy_document" "reminder" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.slack_bot_token_arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [var.dynamodb_table_arn]
  }
}

resource "aws_iam_role_policy" "reminder" {
  name   = "app"
  role   = aws_iam_role.function["reminder"].id
  policy = data.aws_iam_policy_document.reminder.json
}

data "aws_iam_policy_document" "report" {
  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.slack_bot_token_arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"]
    resources = [var.dynamodb_table_arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["dynamodb:Query"]
    resources = [var.dynamodb_gsi1_arn]
  }
}

resource "aws_iam_role_policy" "report" {
  name   = "app"
  role   = aws_iam_role.function["report"].id
  policy = data.aws_iam_policy_document.report.json
}

# --- Lambda functions ---------------------------------------------------------

resource "aws_lambda_function" "function" {
  for_each = local.functions

  function_name = each.value.name
  role          = aws_iam_role.function[each.key].arn
  runtime       = var.nodejs_runtime
  architectures = [var.architecture]
  handler       = each.value.handler
  s3_bucket     = var.artifact_bucket
  s3_key        = each.value.artifact
  timeout       = each.value.timeout
  memory_size   = each.value.memory_size

  environment {
    variables = each.value.env
  }

  tracing_config {
    mode = "Active"
  }

  tags = var.tags

  depends_on = [
    aws_cloudwatch_log_group.function,
    aws_iam_role_policy.logs,
    aws_iam_role_policy.xray,
  ]
}

# Nomination queue → worker. Kept here so both the queue ARN and the worker ARN
# resolve in the same module graph and neither needs a placeholder.
resource "aws_lambda_event_source_mapping" "nomination_worker" {
  event_source_arn        = var.nomination_queue_arn
  function_name           = aws_lambda_function.function["nomination_worker"].arn
  batch_size              = var.sqs_batch_size
  function_response_types = ["ReportBatchItemFailures"]
}
