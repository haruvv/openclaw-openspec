## Why

RevenueAgentPlatform now has a usable admin dashboard, but production run history, site results, and generated proposal artifacts are still stored on Cloudflare Container ephemeral disk. Cloudflare Containers can restart with a fresh filesystem, so the current SQLite file cannot be treated as durable operational data.

## What Changes

- Persist operational records outside the Container filesystem.
- Store relational operational data such as agent runs, run steps, artifacts metadata, analyzed sites, snapshots, proposals metadata, outreach logs, and target/payment state in a durable database.
- Store larger generated artifact bodies, such as proposal markdown, in durable object storage when appropriate.
- Keep local development and tests able to use the existing SQLite path without requiring Cloudflare services.
- Add deployment and verification behavior that proves production no longer depends on `/tmp` SQLite for admin-visible history.
- Document migration and rollback expectations for existing ephemeral data.

## Capabilities

### New Capabilities

- `operational-data-persistence`: Defines durable storage requirements for run history, site results, proposal artifacts, and local-development fallback.

### Modified Capabilities

- `revenue-agent-platform-deployment`: Production deployment must configure durable storage bindings and must not rely on Container-local SQLite as the source of truth.

## Impact

- Affected code: `src/utils/db.ts`, repository modules under `src/agent-runs`, `src/sites`, `src/pipeline`, `src/outreach-sender`, `src/stripe-payment-link`, and `src/hil-approval-flow`.
- Affected deployment: `wrangler.jsonc`, Cloudflare D1/R2 resources or equivalent durable storage bindings, GitHub Actions smoke tests, and operations documentation.
- Affected data model: current SQLite schema becomes either a local-development implementation or a migration source; production storage must preserve the admin dashboard read paths.
- New operational dependency: Cloudflare durable storage, preferably D1 for relational data and R2 for large proposal artifacts.
