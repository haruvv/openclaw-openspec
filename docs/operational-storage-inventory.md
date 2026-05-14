# Operational Storage Inventory

This inventory records the current operational data access points before the durable-storage migration.

## Current SQLite entry point

- `src/utils/db.ts`
  - Opens `DB_PATH`, defaults to `./data/pipeline.db`.
  - Initializes all operational tables and indexes on first access.
  - Production currently sets `DB_PATH=/tmp/revenue-agent/pipeline.db`, which is Container-local and ephemeral.

## Repository operations

| Area | File | Current operations |
| --- | --- | --- |
| Agent runs | `src/agent-runs/repository.ts` | Create running run, complete run with steps and artifacts in a transaction, list recent runs, read run detail. |
| Site results | `src/sites/repository.ts` | Upsert analyzed site, insert snapshot, insert proposal records in a transaction, list sites, read site detail. |
| Targets | `src/pipeline/state.ts` | Save target, get target by ID, list targets by status. |
| Outreach | `src/outreach-sender/sender.ts` | Check cooldown duplicate, check daily send count, insert outreach send log. |
| HIL | `src/hil-approval-flow/approval-handler.ts` | Mark target approved or rejected. |
| HIL timeout | `src/hil-approval-flow/timeout-watcher.ts` | List stale HIL targets, mark them on hold, re-notify Telegram. |
| Payment links | `src/stripe-payment-link/payment-link.ts` | Read target, update payment link fields, list expiring payment links, mark reminders sent. |
| Stripe webhook | `src/stripe-payment-link/webhook-handler.ts` | Mark target paid after Stripe confirmation. |

## Data tables

- `targets`
- `outreach_log`
- `agent_runs`
- `agent_run_steps`
- `agent_artifacts`
- `analyzed_sites`
- `site_snapshots`
- `site_proposals`

## Durable-storage implications

- `agent_runs`, `agent_run_steps`, `agent_artifacts`, `analyzed_sites`, `site_snapshots`, and `site_proposals` must preserve the admin API response shapes.
- `targets` is shared across pipeline state, HIL, and payment status transitions, so it needs a single durable interface instead of feature-specific direct updates.
- `outreach_log` is a simple append/read model and can be exposed as cooldown and quota operations.
- Artifact bodies currently live inline in SQLite. Large bodies need object metadata plus R2-backed retrieval.
- R2 object keys should use stable, non-public prefixes:
  - Agent run artifacts: `agent-runs/{runId}/{artifactId}-{safeLabel}`
  - Site proposal artifacts: `sites/{siteId}/proposals/{proposalId}-{safeLabel}`
  - Future artifacts: `{capability}/{ownerId}/{artifactId}-{safeLabel}`
