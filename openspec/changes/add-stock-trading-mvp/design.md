## Context

The admin platform is already structured as a multi-business-app console with SEO sales active and stock trading present as a planned entry. The deployed runtime is a Cloudflare Worker plus Container: the Worker exposes the admin assets and a durable storage bridge, while the Container runs the Express app and writes operational data through durable-http into D1/R2. Local direct Node execution can still fall back to the repository's SQLite path, but that is not the deployed storage path. The stock trading MVP should fit into the existing Worker/Container/admin shape rather than introduce a second frontend, a new backend framework, or a broker-first trading system.

The product direction from `docs/stack/stack-trade-design.md` is to build an AI trader operating dashboard first: decisions, paper executions, portfolio movement, and learning history. Real broker order placement is intentionally out of scope until the system has accumulated enough paper-trading and backtest evidence.

## Goals / Non-Goals

**Goals:**

- Activate the stock trading app under `/admin/stock-trading` with dashboard, AI decisions, trades, lessons, and settings/status views.
- Persist AI decision logs, per-agent opinions, internal paper trades, portfolio snapshots, and learning items.
- Keep the MVP usable without moomoo, TradingView, or other live provider credentials.
- Make all stock trading execution state explicitly internal paper/demo/manual state.
- Follow existing Express API, React admin UI, admin auth, and operational storage patterns.

**Non-Goals:**

- Real-money broker order placement, order cancellation, fund transfer, account mutation, or broker account reconciliation.
- A production-grade market data collector, historical candle warehouse, backtesting engine, or walk-forward optimizer.
- A new app host, Next.js migration, FastAPI/NestJS service, or PostgreSQL migration.
- Automatic skill file modification from lessons. The MVP records whether a lesson is applied; applying it remains manual.
- Financial advice guarantees, performance claims, or autonomous live trading.

## Decisions

1. Implement stock trading as a first-class admin business app.

   `/admin/stock-trading` will become the canonical app home, with subroutes for decisions, trades, lessons, and settings. The business app registry will mark `stock-trading` active and expose primary links. This reuses the current admin app shell, auth, and navigation model. A separate product app was considered, but it would duplicate authentication, routing, build, and deployment work before the MVP needs it.

2. Use dedicated stock trading tables instead of overloading `agent_runs`.

   Stock trading has domain records that are queried directly by symbol, action, execution source, portfolio time, and learning category. Dedicated tables such as `stock_ai_decisions`, `stock_agent_decisions`, `stock_trades`, `stock_portfolio_snapshots`, and `stock_learning_items` keep these workflows testable and avoid embedding core state inside generic JSON artifacts. `agent_runs` remains useful later for scheduled scanners or AI analysis jobs, but the operator dashboard should not depend on run records for its primary ledger.

3. Add a stock trading repository layer that uses the existing operational storage abstraction.

   The repository should mirror the current pattern used by agent runs: use `DurableHttpStorageClient.executeSql()` when durable-http storage is configured, which is the Cloudflare deployed path backed by D1/R2, and use local SQLite through `getDb()` only for direct local Node fallback/tests. This keeps Cloudflare deployment behavior aligned with the rest of the platform and avoids making stock trading data local-only.

4. Treat internal paper trades as the source of portfolio state for MVP.

   Trades recorded through the stock trading UI will be labeled by execution source (`paper`, `demo`, or `manual`) and will never be represented as confirmed real broker fills. Portfolio snapshots are derived from internal state and manually supplied or placeholder prices in the MVP. A broker-backed paper account could be reconciled later, but relying on moomoo demo account behavior as the only ledger would make early testing provider-dependent.

5. Keep AI decision creation structured but provider-agnostic.

   The first version will store decision outputs as structured records: final action, confidence, strategy tag, reasoning, risk factors, take-profit, stop-loss, and specialist agent opinions. The UI/API can seed sample decisions or accept manually reviewed decision payloads. Actual multi-agent orchestration and market-data ingestion can be added behind the same persistence contract later.

6. Enforce paper-only behavior at API and UI boundaries.

   No stock trading API route will call broker order endpoints. Settings will show provider readiness as configured/missing status without exposing secrets or enabling live order actions. UI copy and execution source fields must label all executions as paper/demo/manual. This makes the safety boundary visible and testable rather than relying only on developer intent.

7. Use existing React component patterns before adding chart dependencies.

   The first dashboard can use metrics, tables, and simple responsive panels already present in the admin UI. Lightweight Charts or similar charting libraries can be added when equity curves or candle charts require them. Avoiding a chart dependency in the first implementation keeps the MVP smaller and avoids implying live market data support.

## Risks / Trade-offs

- Provider-free MVP may feel less realistic than a live market-data app. Mitigation: clearly label integration status and keep repository/API contracts ready for later provider-backed data.
- Dedicated tables add schema surface area. Mitigation: keep table names scoped with `stock_` prefixes and repository methods narrow.
- Portfolio calculations can become inaccurate if price data is manual or stale. Mitigation: display paper portfolio state as internal simulation data and store snapshot timestamps.
- Durable-http SQL support must include the new tables before deployment. Mitigation: initialize stock tables through the shared schema path and cover repository behavior in tests where practical.
- UI activation could make users expect real trading. Mitigation: mark the app and executions as paper-only throughout the UI and omit live order controls entirely.
- Learning items may accumulate low-quality rules if every review is treated as truth. Mitigation: persist confidence and applied-to-skill state, and keep skill application manual for MVP.

## Migration Plan

1. Add stock trading tables to the operational schema initialization with idempotent `CREATE TABLE IF NOT EXISTS` statements and indexes.
2. Add stock trading types and repository functions for listing dashboard data, decisions, trades, snapshots, learning items, and integration status.
3. Add authenticated `/api/admin/stock-trading/*` routes for dashboard, decisions, trades, lessons, and settings/status.
4. Update the business app registry and admin UI routes/navigation to expose `/admin/stock-trading`.
5. Add React pages using existing admin components and empty states.
6. Add tests for schema/repository behavior, API responses, route access, and paper-only constraints.
7. Validate with `npm test`, `npm run build`, and OpenSpec validation.

Rollback is low risk because the change only adds tables and routes. If needed, mark the stock trading app back to planned/hidden while leaving added tables unused.

## Open Questions

- Should the initial paper portfolio start with a fixed default capital, or should operators configure it in settings before the first snapshot?
- Should MVP include a manual form for creating AI decisions/trades, seed demo data for evaluation, or only expose read APIs until the first decision runner exists?
- Which market universe should the first provider-backed scanner target: Japanese equities, US equities, or a small configurable watchlist?
