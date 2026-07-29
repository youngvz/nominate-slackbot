# ADR-002: DynamoDB over PostgreSQL

## Status

Accepted, overriding the research report's primary PostgreSQL recommendation.

## Decision

Use DynamoDB on-demand for Phase 1 operational persistence.

## Rationale

The project prioritizes low idle cost, serverless operations, and maintenance alignment with Lambda. The workload is small and its access patterns can be defined explicitly.

## Correctness requirement

The rolling 14-day rule must use `TransactWriteItems` with a nomination record and pair eligibility record. DynamoDB TTL is cleanup only and may not determine eligibility.

## Consequences

Reporting requires a deliberate GSI and application aggregation. Advanced ad hoc reporting is less convenient than PostgreSQL. Concurrency and idempotency tests are mandatory.
