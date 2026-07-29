# Four Lambdas per docs/07-aws-infrastructure.md §Edge and compute:
#   - slack-ingress
#   - nomination-worker
#   - reminder
#   - report
# Each receives its own IAM role. Avoid wildcard actions/resources per docs/07 §IAM boundaries.
# Prefer ARM64 after compatibility testing per docs/07 §Runtime and packaging.
