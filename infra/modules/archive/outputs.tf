output "bucket_name" {
  description = "Archive S3 bucket name."
  value       = aws_s3_bucket.archive.bucket
}

output "bucket_arn" {
  description = "Archive S3 bucket ARN."
  value       = aws_s3_bucket.archive.arn
}
