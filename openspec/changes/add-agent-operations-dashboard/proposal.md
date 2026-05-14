## Why

RevenueAgentPlatform currently returns execution results through the request channel, but it does not persist run history, step-level diagnostics, artifacts, or integration health in a place operators can inspect. This made the Telegram webhook issue harder to diagnose because Telegram delivery, Worker routing, Container rollout, and downstream agent execution had to be checked through separate tools and transient logs.

An extensible operations dashboard will make agent runs observable and manageable before more workflows are added beyond SEO analysis.

## What Changes

- Add an admin dashboard for agent operations, starting with RevenueAgent runs but modeled for future agent types.
- Persist agent run records, step statuses, errors, timing, source channel, target input, and artifacts in SQLite.
- Add run list and run detail views showing status, step outcomes, generated proposal content, and error summaries.
- Add channel and integration status views for Telegram, Cloudflare runtime state, and configured external providers without exposing secret values.
- Add manual run and retry actions so operators can reproduce failures from the dashboard.
- Keep side effects explicit in the run record so email, Telegram notification, and payment link steps are visible even when disabled by policy.
- Avoid adding destructive controls or secret editing in the first version.

## Capabilities

### New Capabilities

- `agent-operations-dashboard`: Provides persisted agent run observability, run detail inspection, artifacts, integration status, and manual operational actions through an admin UI.

### Modified Capabilities

- None.

## Impact

- Adds SQLite tables or migrations for agent runs, run steps, artifacts, and operational events.
- Extends RevenueAgent execution to record run lifecycle and artifacts instead of only returning an in-memory report.
- Adds Express admin/API routes and static/admin UI assets served by the existing Container.
- Adds Telegram webhook visibility and provider configuration status checks without exposing secret contents.
- May require lightweight UI dependencies if the dashboard is implemented with a frontend bundle.
- Cloudflare Container deployment remains the hosting target; Worker routing should continue to protect public webhook and API entry points.
