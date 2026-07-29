provider "aws" {
  region = var.aws_region
  default_tags {
    tags = local.tags
  }
}

# Composition of reusable modules per docs/08 §Repository structure.
# Modules are wired end-to-end in the implementation pass.

module "secrets" {
  source      = "../../modules/secrets"
  project     = var.project
  environment = var.environment
  tags        = local.tags
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  project     = var.project
  environment = var.environment
  table_name  = "${var.project}-${var.environment}-app"
  tags        = local.tags
}

module "messaging" {
  source              = "../../modules/messaging"
  project             = var.project
  environment         = var.environment
  worker_function_arn = "arn:aws:lambda:${var.aws_region}:000000000000:function:${var.project}-${var.environment}-nomination-worker"
  tags                = local.tags
}

module "archive" {
  source      = "../../modules/archive"
  project     = var.project
  environment = var.environment
  bucket_name = "${var.project}-${var.environment}-archive"
  tags        = local.tags
}

module "compute" {
  source                   = "../../modules/compute"
  project                  = var.project
  environment              = var.environment
  artifact_bucket          = var.artifact_bucket
  dynamodb_table_name      = module.dynamodb.table_name
  dynamodb_table_arn       = module.dynamodb.table_arn
  nomination_queue_url     = module.messaging.queue_url
  nomination_queue_arn     = module.messaging.queue_arn
  slack_signing_secret_arn = module.secrets.signing_secret_arn
  slack_bot_token_arn      = module.secrets.bot_token_arn
  recognition_channel_id   = var.recognition_channel_id
  tags                     = local.tags
}

module "api" {
  source                    = "../../modules/api"
  project                   = var.project
  environment               = var.environment
  ingress_lambda_invoke_arn = module.compute.slack_ingress_invoke_arn
  tags                      = local.tags
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
  source                = "../../modules/observability"
  project               = var.project
  environment           = var.environment
  dlq_arn               = module.messaging.dlq_arn
  queue_url             = module.messaging.queue_url
  lambda_function_names = []
  tags                  = local.tags
}
