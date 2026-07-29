# ADR-001: Slack Interaction Model

## Status

Accepted.

## Decision

Use `/nominate` as the primary entry point and open a structured Slack modal. Use production HTTP request URLs through API Gateway rather than Socket Mode.

## Rationale

The modal provides reliable recipient selection and required description validation. HTTP supports a serverless request model and avoids continuously running Socket Mode infrastructure.

## Consequences

The ingress path must verify Slack signatures, acknowledge quickly, and use the command trigger before it expires. A future message shortcut may reuse the same modal and domain service.
