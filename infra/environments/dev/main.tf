provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.tags
  }
}

# Composition of reusable modules per docs/08 §Repository structure.

module "secrets" {
  source                  = "../../modules/secrets"
  project                 = var.project
  environment             = var.environment
  recovery_window_in_days = 0
  tags                    = local.tags
}

module "dynamodb" {
  source                     = "../../modules/dynamodb"
  project                    = var.project
  environment                = var.environment
  table_name                 = "${var.project}-${var.environment}-app"
  enable_deletion_protection = var.enable_deletion_protection
  tags                       = local.tags
}

module "messaging" {
  source      = "../../modules/messaging"
  project     = var.project
  environment = var.environment
  tags        = local.tags
}

module "archive" {
  source                    = "../../modules/archive"
  project                   = var.project
  environment               = var.environment
  bucket_name               = "${var.project}-${var.environment}-archive"
  force_destroy             = var.force_destroy
  lifecycle_expiration_days = 30
  tags                      = local.tags
}

module "compute" {
  source                   = "../../modules/compute"
  project                  = var.project
  environment              = var.environment
  artifact_bucket          = var.artifact_bucket
  dynamodb_table_name      = module.dynamodb.table_name
  dynamodb_table_arn       = module.dynamodb.table_arn
  dynamodb_gsi1_arn        = module.dynamodb.gsi1_arn
  nomination_queue_url     = module.messaging.queue_url
  nomination_queue_arn     = module.messaging.queue_arn
  slack_signing_secret_arn = module.secrets.signing_secret_arn
  slack_bot_token_arn      = module.secrets.bot_token_arn
  recognition_channel_id   = var.recognition_channel_id
  slack_maintainer_ids     = join(",", var.maintainer_slack_ids)
  program_start_at         = var.program_start_at
  first_report_at          = var.first_report_at
  report_workspace_id      = var.report_workspace_id
  log_retention_days       = var.log_retention_days
  tags                     = local.tags
}

module "api" {
  source                      = "../../modules/api"
  project                     = var.project
  environment                 = var.environment
  ingress_lambda_invoke_arn   = module.compute.slack_ingress_invoke_arn
  ingress_lambda_function_arn = module.compute.slack_ingress_function_arn
  log_retention_days          = var.log_retention_days
  tags                        = local.tags
}

module "scheduling" {
  source              = "../../modules/scheduling"
  project             = var.project
  environment         = var.environment
  reminder_target_arn = module.compute.reminder_function_arn
  report_target_arn   = module.compute.report_function_arn
  tags                = local.tags
}

module "observability" {
  source      = "../../modules/observability"
  project     = var.project
  environment = var.environment
  dlq_arn     = module.messaging.dlq_arn
  dlq_name    = module.messaging.dlq_name
  queue_url   = module.messaging.queue_url
  queue_name  = module.messaging.queue_name
  lambda_function_names = [
    module.compute.slack_ingress_function_name,
    module.compute.nomination_worker_function_name,
    module.compute.reminder_function_name,
    module.compute.report_function_name,
  ]
  tags = local.tags
}
