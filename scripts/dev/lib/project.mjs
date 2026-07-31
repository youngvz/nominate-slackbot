// Per-env project-name resolution for dev-only scripts.
//
// The `project` Terraform variable diverges by environment: dev is still
// `nominate-slackbot`; production was renamed to `kudosbot`. Lambda function
// and log-group names follow `${project}-${env}-*`, so scripts that build
// those names have to resolve the project name for the target environment
// rather than hardcoding one.
//
// Override with PROJECT=<name> when needed.

const PROJECT_BY_ENV = {
  dev: "nominate-slackbot",
  production: "kudosbot",
};

export function projectFor(env) {
  if (process.env.PROJECT) return process.env.PROJECT;
  const name = PROJECT_BY_ENV[env];
  if (!name) throw new Error(`Unknown env "${env}" — expected dev or production.`);
  return name;
}
