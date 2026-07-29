# ADR-005: Reporting and Eligibility Windows

## Status

Accepted.

## Decision

Eligibility uses a rolling 14 × 24-hour window per workspace, nominator, and recipient. Reporting uses fixed half-open periods in `America/New_York`, anchored to the July 31, 2026 program start and the first August 14, 2026 noon report.

## Rationale

Rolling eligibility prevents gaming around report boundaries. Fixed reporting periods are auditable, rerunnable, and easy to communicate.

## Consequences

Eligibility does not reset when a report is published. Boundary tests and DST-aware scheduling are required.
