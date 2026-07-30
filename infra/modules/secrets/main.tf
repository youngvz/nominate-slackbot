resource "aws_secretsmanager_secret" "signing_secret" {
  name        = "${var.project}-${var.environment}-slack-signing-secret"
  description = "Slack signing secret for ${var.project} ${var.environment}. Value populated out-of-band."
  kms_key_id  = var.kms_key_arn == "" ? null : var.kms_key_arn
  tags        = var.tags
}

resource "aws_secretsmanager_secret" "bot_token" {
  name        = "${var.project}-${var.environment}-slack-bot-token"
  description = "Slack bot token for ${var.project} ${var.environment}. Value populated out-of-band."
  kms_key_id  = var.kms_key_arn == "" ? null : var.kms_key_arn
  tags        = var.tags
}
