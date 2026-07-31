# Security, Privacy, and Audit

## Slack request verification

Every inbound Slack request must:

1. Preserve the exact raw body.
2. Read Slack signature and timestamp headers.
3. Reject timestamps outside the accepted replay window.
4. Reconstruct and verify the signature using the signing secret.
5. Use constant-time comparison.
6. Reject the request before parsing business input when verification fails.

## Secrets

Store the Slack signing secret and bot token in AWS Secrets Manager. Never place them in:

- Source code.
- `.env.example` values.
- Terraform state as plaintext inputs.
- Logs.
- SQS payloads.

Rotate secrets through an operational procedure and redeploy or refresh consumers safely.

## Authorization

Anyone in the workspace may nominate eligible employees.

Administrative or audit operations are limited to:

- Configured maintainer Slack IDs.
- Approved workspace admins or owners when their status can be verified.
- Authorized AWS operator roles.

Authorization must be enforced server-side, not only by hiding Slack controls.

## Privacy behavior

Public report:

- Winner identities and counts are public in the configured channel.
- Nominator identities are not public.
- Recognition descriptions are not posted publicly.

Winner DM:

- Contains descriptions for that winner.
- Does not contain author identity.
- Cannot guarantee social anonymity because wording may identify the author.

## Auditability

The operational record retains:

- Nominator Slack ID.
- Recipient Slack ID.
- Description.
- Submission timestamp.
- Workspace ID.
- Correlation and idempotency identifiers.

Authorized maintainers can trace an inappropriate message to its author through controlled operational or future administrative tooling.

## Logging rules

Do not log:

- Full nomination descriptions.
- Slack tokens or signing secrets.
- Raw signed request bodies in production.
- Complete user profile objects.

Logs may include:

- Hashed or stable internal identifiers where appropriate.
- Slack IDs when operationally required and access-controlled.
- Nomination ID.
- Outcome category.
- Correlation ID.
- Latency and dependency status.

Operator dev tooling (`scripts/dev/`) may print nomination descriptions to
the operator's terminal when explicitly requested with `--full`; the
default is truncation to the first 40 characters, and this exception is
scoped to interactive dev use against non-production workspaces. It does
not permit descriptions in application logs, exports, or shared channels.

## Data retention

- DynamoDB nomination data: one year.
- S3 audit/archive data: recommended three years, subject to organizational approval.
- Aggregate published report metadata: retained indefinitely unless policy changes.
- Eligibility cleanup: TTL after the eligibility window, while logic remains timestamp-based.

## S3 controls

- Block all public access.
- Enable encryption and versioning.
- Limit access with IAM and bucket policy.
- Configure lifecycle expiration.
- Record access through the organization's standard audit mechanism.

## Open-source controls

The public repository must contain placeholders only. Add automated secret scanning and ensure examples use fake Slack IDs, channel IDs, account IDs, and ARNs.
