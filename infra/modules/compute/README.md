# compute module

Provisions the four Lambdas listed in `docs/07-aws-infrastructure.md` §Edge and compute and their IAM roles per `docs/07` §IAM boundaries.

Each function gets its own execution role. See `docs/07` §IAM boundaries for the exact per-function permission scope (ingress, worker, reminder, report).
