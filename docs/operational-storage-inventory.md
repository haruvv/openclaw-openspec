# Operational Storage Inventory

This document records the current storage contract so future work does not accidentally treat SQLite as the production data store.

## Production Source Of Truth

Production operational data is stored in Cloudflare durable storage:

- D1 database binding: `OPERATIONAL_DB`
- R2 bucket binding: `OPERATIONAL_ARTIFACTS`
- Worker bridge: `worker/storage-bridge.ts`
- Container client: `src/storage/durable-http.ts`

The Container does not talk to D1/R2 bindings directly. It receives:

- `DURABLE_STORAGE_BASE_URL`
- `DURABLE_STORAGE_TOKEN`

When both values are present, `src/storage/config.ts` selects `mode: "durable-http"`. Repository modules then use `DurableHttpStorageClient.executeSql()` and artifact body helpers against the Worker bridge.

## SQLite Role

SQLite still exists, but it is fallback compatibility:

- Direct local Node runs without durable env vars
- Unit tests that intentionally isolate storage with temporary `DB_PATH`
- Emergency rollback if durable storage is explicitly disabled

Do not describe production behavior as SQLite-backed unless the task is specifically about fallback mode. `DB_PATH=/tmp/revenue-agent/pipeline.db` exists in Container env, but it is not the production source of truth when durable storage is configured.

## Auth Contract

Production admin auth is Cloudflare Access, not `ADMIN_TOKEN`.

- Worker validates Access before serving `/admin` and `/admin/*`.
- Container validates Access for `/api/admin/*` through `authorizeAdminRequest`.
- `ADMIN_TOKEN` is local/development fallback and emergency rollback fallback only.
- Production query-token auth requires the explicit rollback flag `CLOUDFLARE_ACCESS_ALLOW_ADMIN_TOKEN_FALLBACK=true`.

When testing production-like admin paths, use Cloudflare Access service tokens or Access assertions. Use `?token=<ADMIN_TOKEN>` only for direct local Express checks or fallback-specific tests.

## Repository Operations

| Area | File | Production storage path |
| --- | --- | --- |
| Agent runs | `src/agent-runs/repository.ts` | durable-http to D1; large artifacts can use R2 |
| Site results | `src/sites/repository.ts` | durable-http to D1; proposal bodies can use R2 |
| Sales actions | `src/sales/repository.ts` | durable-http to D1 |
| App settings | `src/admin/side-effect-settings.ts`, `src/discovery/settings.ts`, `src/sales/settings.ts` | durable-http to D1 |
| Stock trading MVP | `src/stock-trading/repository.ts` | durable-http to D1 |
| Local fallback schema | `src/storage/sqlite.ts` | SQLite only when durable-http is not configured |

## Data Tables

Core operational tables:

- `targets`
- `outreach_log`
- `agent_runs`
- `agent_run_steps`
- `agent_artifacts`
- `analyzed_sites`
- `site_snapshots`
- `site_proposals`
- `app_settings`
- `sales_outreach_messages`
- `sales_payment_links`

Stock trading tables:

- `stock_ai_decisions`
- `stock_agent_decisions`
- `stock_trades`
- `stock_portfolio_snapshots`
- `stock_learning_items`

## Local Production-Like Verification

The closest local check is:

1. Start Worker local runtime with D1/R2 bindings.
2. Apply `migrations/*.sql` through `/internal/storage/sql` or Wrangler D1 local tooling.
3. Start Express with:

```bash
DURABLE_STORAGE_BASE_URL=http://localhost:8787 \
DURABLE_STORAGE_TOKEN=<local-token> \
PORT=3001 \
npm run start
```

4. Check:

```bash
curl http://localhost:8787/health
curl http://localhost:3001/health
```

Expected:

- Worker health: `storage.mode = durable-http`, `d1Readable = true`, `r2Configured = true`
- Express health: `storage.mode = durable-http`, `durableConfigured = true`

Direct `npm run start` without durable env vars is a SQLite fallback check, not a production-like storage check.
