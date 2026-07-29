# ADR-003: Serverless AWS Architecture

## Status

Accepted.

## Decision

Use API Gateway HTTP API, Lambda, SQS, DynamoDB, EventBridge Scheduler, Secrets Manager, CloudWatch, and optional S3 archives.

## Rationale

This model minimizes idle infrastructure cost and operational maintenance while satisfying Slack acknowledgement, retry, scheduling, and persistence requirements.

## Consequences

All consumers must tolerate retries and duplicate delivery. Public side effects require explicit idempotency state. No VPC or NAT gateway is required in Phase 1.
