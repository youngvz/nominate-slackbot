resource "aws_dynamodb_table" "app" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  deletion_protection_enabled = var.enable_deletion_protection

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name            = var.gsi1_name
    hash_key        = "GSI1PK"
    range_key       = "GSI1SK"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = var.ttl_attribute
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.enable_pitr
  }

  #tfsec:ignore:aws-dynamodb-table-customer-key AWS-managed SSE is sufficient; docs/05 and docs/09 don't mandate a CMK
  server_side_encryption {
    enabled = true
  }

  tags = var.tags
}

# Scheduled DynamoDB export to S3 is deferred until the archive integration is
# operationalized. Tracking: docs/07 §Persistence — "Optional scheduled export".
# When enable_scheduled_export = true and archive_bucket_arn is provided a
# follow-up implementation should add aws_dynamodb_table_export resources or an
# EventBridge-driven export job. Left unimplemented to keep the module surface
# aligned with Phase 1 scope.
