# Slack app manifests

`manifest.json` is the source of truth for the Slack app configuration
(scopes, `/nominate` slash command, interactivity URL). The dev, staging, and
production Slack apps are all installed from this same manifest — only the
request URLs and app name differ per environment.

See `docs/17-slack-app-setup.md` for the setup procedure (dashboard flow and
CLI flow both documented).

Do **not** commit real request URLs, signing secrets, or bot tokens. The
manifest keeps request URLs as `https://REPLACE_ME.example/slack/events`
placeholders; installers substitute the tunnel or API Gateway URL at install
time.
