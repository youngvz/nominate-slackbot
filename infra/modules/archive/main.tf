#tfsec:ignore:aws-s3-enable-bucket-logging docs/09 §S3 controls: access captured by org audit mechanism, not per-bucket logs. A log-target bucket would recurse into the same rule.
resource "aws_s3_bucket" "archive" {
  bucket        = var.bucket_name
  force_destroy = var.force_destroy
  tags          = var.tags
}

resource "aws_s3_bucket_versioning" "archive" {
  bucket = aws_s3_bucket.archive.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "archive" {
  bucket                  = aws_s3_bucket.archive.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "archive" {
  bucket = aws_s3_bucket.archive.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_arn == "" ? "AES256" : "aws:kms"
      kms_master_key_id = var.kms_key_arn == "" ? null : var.kms_key_arn
    }
    bucket_key_enabled = var.kms_key_arn != ""
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "archive" {
  bucket = aws_s3_bucket.archive.id

  rule {
    id     = "expire-archived-objects"
    status = "Enabled"

    filter {}

    expiration {
      days = var.lifecycle_expiration_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.lifecycle_expiration_days
    }
  }
}

data "aws_iam_policy_document" "archive" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.archive.arn, "${aws_s3_bucket.archive.arn}/*"]
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  dynamic "statement" {
    for_each = length(var.authorized_role_arns) > 0 ? [1] : []
    content {
      sid    = "DenyAllExceptAuthorizedRoles"
      effect = "Deny"
      principals {
        type        = "AWS"
        identifiers = ["*"]
      }
      actions   = ["s3:*"]
      resources = [aws_s3_bucket.archive.arn, "${aws_s3_bucket.archive.arn}/*"]
      condition {
        test     = "ArnNotEquals"
        variable = "aws:PrincipalArn"
        values   = var.authorized_role_arns
      }
    }
  }
}

resource "aws_s3_bucket_policy" "archive" {
  bucket = aws_s3_bucket.archive.id
  policy = data.aws_iam_policy_document.archive.json
}
