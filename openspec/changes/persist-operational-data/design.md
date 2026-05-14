## Context

RevenueAgentPlatform currently runs as an Express app inside a Cloudflare Container. The repositories use `better-sqlite3` through `src/utils/db.ts`, with production configured to write `/tmp/revenue-agent/pipeline.db`. Cloudflare Containers have ephemeral disk, so a sleeping, restarted, or newly versioned container can lose admin-visible run history and site results.

Cloudflare D1 and R2 are Worker bindings. The Worker wrapper can access these bindings directly, while the Container process cannot access Worker bindings as in-process objects. This creates an architectural boundary: either the Container must call a durable-storage API exposed by the Worker, or the storage-accessing code must move to the Worker side.

## Goals / Non-Goals

**Goals:**

- Make production run history, site results, proposal metadata, target state, outreach logs, and payment/HIL state durable across Container restarts and deploys.
- Keep local development and tests simple by retaining SQLite as a local adapter.
- Use Cloudflare-native durable storage where practical: D1 for relational operational data and R2 for larger artifact bodies.
- Preserve the existing admin dashboard API contract while changing the storage implementation behind it.
- Provide an explicit migration path from the current SQLite schema to durable storage.

**Non-Goals:**

- Rebuild the admin UI.
- Implement multi-tenant customer isolation.
- Make generated files public.
- Preserve every historical row from existing ephemeral production containers automatically; existing data may require manual export before a rollout.

## Decisions

### Introduce a storage adapter boundary

Create a small application-level storage interface for the repository operations currently backed by `better-sqlite3`. Local development and tests use a SQLite adapter. Production uses a durable adapter.

Rationale: replacing every repository call with D1-specific code in one pass would couple application logic directly to Cloudflare APIs. An adapter boundary keeps local tests fast and lets production use D1/R2 without forcing the entire app into Worker-only runtime assumptions.

Alternative considered: keep SQLite and periodically copy the DB to R2. This risks data loss between snapshots and does not solve concurrent writes during deploys.

### Use D1 for relational operational data

D1 is the primary durable store for structured operational data: agent runs, steps, artifact metadata, analyzed sites, snapshots, proposals metadata, outreach logs, targets, and payment/HIL state.

Rationale: the existing schema is SQLite-shaped, and D1 is SQLite-compatible through Worker bindings. This reduces migration risk compared with moving immediately to a different relational database.

Alternative considered: external Postgres via Hyperdrive. That is stronger for high write volume and richer SQL operations, but it adds account/database management before the product needs it.

### Use R2 for large artifact bodies

Store large proposal bodies and future bulky artifacts in R2, while D1 stores artifact metadata and object keys. Small artifact text can still be stored inline if it is below a configured threshold.

Rationale: proposal markdown and future artifacts can grow independently from run metadata. R2 keeps D1 rows smaller and makes future downloads/exports easier.

Alternative considered: store all artifact bodies in D1. This is simpler initially but makes relational rows heavier and less suitable for large generated documents.

### Bridge Container to durable storage through internal HTTP

The Worker wrapper owns D1/R2 bindings and exposes internal storage endpoints to the Container. The Container receives an internal storage base URL and token through environment variables and uses the durable adapter in production.

Rationale: Cloudflare bindings are available in the Worker runtime, not directly inside the Container process. Internal HTTP keeps the current Express app intact while letting the Worker perform D1/R2 operations.

Alternative considered: move all admin APIs and repository logic into the Worker. That would reduce the HTTP bridge but requires a larger rewrite and would make the Node/SQLite local runtime less representative.

### Keep SQLite as the local fallback

If durable storage environment variables are absent, the app continues to use `better-sqlite3` and `DB_PATH`.

Rationale: local development, tests, and smoke workflows already rely on the SQLite implementation. This keeps the migration incremental and avoids requiring Cloudflare resources for every test.

## Risks / Trade-offs

- **Internal storage API becomes a new boundary** → Keep endpoints narrow, authenticated with a Worker-generated internal token, and covered by repository-level tests.
- **D1 schema drift** → Add D1 migration files and a CI check that validates migrations can initialize a local SQLite/D1-compatible database.
- **Existing production data is ephemeral** → Provide an export command before rollout and clearly document that data not exported from the live container may be lost.
- **More network hops for repository calls** → Batch writes for run completion and site snapshot persistence so normal workflow completion does not make many separate storage calls.
- **R2 read-after-write expectations** → Store object keys in D1 only after successful R2 `put`; admin detail reads should tolerate missing artifact objects with a clear placeholder.

## Migration Plan

1. Add storage adapter interfaces and keep the current SQLite implementation as the default.
2. Add D1 schema migrations equivalent to the current SQLite schema.
3. Add R2 object-key conventions for proposal and artifact bodies.
4. Add Worker-side internal storage endpoints backed by D1/R2.
5. Add a production durable adapter used by the Container when storage endpoint variables are configured.
6. Update `wrangler.jsonc` with D1 and R2 bindings.
7. Update GitHub Actions to apply D1 migrations before deployment and run post-deploy smoke checks that create/read durable data.
8. Add an export/import script for the existing SQLite schema.
9. Roll out with side effects still disabled.

Rollback: keep SQLite adapter available. If durable storage rollout fails, remove production durable storage env vars or redeploy the previous Worker version so the app returns to Container-local SQLite while the issue is investigated. Any writes made only to D1 during the failed rollout must be exported before rollback if they need to be preserved in local SQLite.

## Open Questions

- Should production use one D1 database for both staging and production with table prefixes, or separate D1 databases per environment? The safer default is separate databases.
- What artifact size threshold should determine inline D1 storage vs R2 storage? A conservative initial threshold is 16 KiB.
- Should existing `/tmp` production data be exported before the first durable rollout, or is it acceptable to start durable storage from an empty state?
