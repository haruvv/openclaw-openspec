## Context

RevenueAgentPlatform runs inside a Cloudflare Container behind a Worker wrapper. RevenueAgent currently returns an in-memory report to the caller and writes proposal files to the container filesystem, but it does not persist operational history in SQLite. During the Telegram webhook rollout, operators had to correlate Telegram `getWebhookInfo`, Worker tail logs, Container rollout state, and agent responses manually.

The dashboard should be an operations surface for agent runs, not an SEO-specific product UI. RevenueAgent is the first producer of run records, but the data model and admin views should allow future agent types to appear without schema changes for every domain-specific field.

## Goals / Non-Goals

**Goals:**

- Persist generic agent run history, step outcomes, artifacts, timing, source channel, and sanitized errors.
- Add a minimal admin UI under the existing Express app for run list, run detail, artifacts, integration status, and manual RevenueAgent execution.
- Keep SEO-specific values in generic JSON columns while exposing useful summary fields for the initial RevenueAgent workflow.
- Preserve existing Telegram/API behavior while recording runs produced by those entry points.
- Avoid exposing secret values in the UI.

**Non-Goals:**

- Full authentication, RBAC, organization management, or secret editing.
- A separate frontend service or separate repository.
- External log aggregation or durable object introspection beyond what can be surfaced from the application.
- Enabling email, Telegram side-effect notifications, or Stripe payment creation by default.

## Decisions

1. Store run observability in the existing SQLite database.

   The dashboard needs to inspect data produced by the same process that runs RevenueAgent. Reusing `getDb()` keeps the first version simple and avoids CORS, cross-service auth, and event delivery concerns. Alternatives considered were Cloudflare Analytics/log scraping and a separate dashboard database; both add operational complexity before the product needs it.

2. Use generic run tables with JSON metadata.

   `agent_runs`, `agent_run_steps`, and `agent_artifacts` will store generic fields such as `agent_type`, `source`, `status`, `input_json`, `summary_json`, `details_json`, and `metadata_json`. SEO-specific values like target URL, domain, score, and proposal path belong in JSON summaries/artifacts rather than first-class schema columns. This keeps the dashboard extensible while still enabling useful display.

3. Instrument RevenueAgent at the run boundary first.

   `runRevenueAgent` already centralizes step execution and returns a structured report. The first implementation will persist the report after the run completes and create a `running` record at start. Fine-grained streaming updates can be added later if long-running diagnostics require live progress.

4. Serve an HTML admin UI from Express.

   A server-rendered HTML UI avoids adding a frontend build pipeline now. It can use existing Express routes and plain CSS while still providing a usable dashboard. A React/Vite app can be introduced later if interaction complexity grows.

5. Keep admin actions narrowly scoped.

   The first version includes manual RevenueAgent execution and retry from existing run input. It does not allow secret editing or destructive deletion. Side effects remain disabled by default unless the underlying API policy explicitly allows them.

## Risks / Trade-offs

- Persisting after run completion means a hard process crash may leave a `running` record without final steps. Mitigation: store `started_at` immediately and display stale running records clearly.
- SQLite in the Container filesystem is sufficient for early operations, but Cloudflare Container `/tmp` storage may not be a long-term source of truth. Mitigation: keep repository APIs isolated so a durable store can replace SQLite later.
- Server-rendered HTML is less dynamic than a frontend app. Mitigation: keep routes and data APIs separated enough to support a later frontend.
- Manual run actions could be abused if exposed publicly. Mitigation: keep `/admin` behind the same deployment boundary initially and add token-based admin protection before broader exposure.
