# dynamodb module

Single application table plus reporting GSI. Reference: `docs/05-dynamodb-data-model.md` and `docs/07-aws-infrastructure.md` §Persistence.

Note: TTL is cleanup only. Application-level correctness compares `nextEligibleAtEpoch` against the current time (see `docs/02-business-rules.md` §Concurrency rule).
