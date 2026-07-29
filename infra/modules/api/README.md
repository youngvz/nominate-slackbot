# api module

API Gateway HTTP API that fronts the Slack ingress Lambda.

Reference: `docs/07-aws-infrastructure.md` §Edge and compute; `docs/03-slack-app-design.md` §Interaction model.

Inputs are declared in `variables.tf`. Outputs export the invoke URL used for the Slack request URL.
