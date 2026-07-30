resource "aws_sqs_queue" "nomination_dlq" {
  name                      = "${var.project}-${var.environment}-nomination-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  tags                      = var.tags
}

resource "aws_sqs_queue" "nomination" {
  name                       = "${var.project}-${var.environment}-nomination"
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.nomination_dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = var.tags
}

# The aws_lambda_event_source_mapping between the nomination queue and the
# nomination worker lives in the compute module. Placing it here creates a
# module dependency cycle (compute → messaging → compute).
