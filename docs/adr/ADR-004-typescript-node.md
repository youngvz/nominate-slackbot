# ADR-004: TypeScript and Node.js

## Status

Accepted.

## Decision

Use TypeScript with Slack Bolt for JavaScript on a currently supported AWS Lambda Node.js runtime.

## Rationale

TypeScript provides strong contracts at Slack, SQS, and DynamoDB boundaries and aligns with the selected Slack SDK ecosystem.

## Consequences

The monorepo should enforce strict type checking, shared contract packages, one package manager, a lockfile, and intentional runtime upgrades.
