## 1. Storage And Domain Model

- [x] 1.1 Add stock trading TypeScript domain types for decisions, agent opinions, trades, portfolio snapshots, learning items, dashboard summaries, and integration status.
- [x] 1.2 Add idempotent `stock_` table creation and indexes to the operational storage schema.
- [x] 1.3 Implement a stock trading repository that reads and writes through the deployed durable-http/D1 path with local SQLite fallback for direct Node runs and tests.
- [x] 1.4 Add repository helpers for dashboard summary data, recent decisions, decision detail with agent opinions, trades, latest portfolio snapshot, portfolio history, learning items, and provider status.
- [x] 1.5 Add seed or fixture helpers for tests without requiring live market data or broker credentials.

## 2. Admin API

- [x] 2.1 Add authenticated `/api/admin/stock-trading/overview` route returning portfolio metrics, recent decisions, recent trades, recent lessons, and integration status.
- [x] 2.2 Add `/api/admin/stock-trading/decisions` and `/api/admin/stock-trading/decisions/:id` routes for decision list and detail.
- [x] 2.3 Add `/api/admin/stock-trading/trades` route for paper trade history.
- [x] 2.4 Add `/api/admin/stock-trading/lessons` route for learning item history.
- [x] 2.5 Add `/api/admin/stock-trading/settings` route showing market-data and broker provider readiness without exposing secret values.
- [x] 2.6 Ensure all stock trading write or execution routes are paper-only and do not call broker order, cancel, transfer, or account mutation APIs.

## 3. Admin App Activation

- [x] 3.1 Update the business app registry so `stock-trading` is active and points to `/admin/stock-trading`.
- [x] 3.2 Add stock trading primary links for dashboard, AI decisions, trades, lessons, and settings.
- [x] 3.3 Update desktop and mobile navigation to include stock trading routes without disrupting SEO sales navigation.
- [x] 3.4 Add React route metadata and route entries for stock trading pages.

## 4. Stock Trading UI

- [x] 4.1 Build the stock trading dashboard page with paper-only status, portfolio metrics, recent decisions, recent trades, recent lessons, and integration readiness.
- [x] 4.2 Build the AI decisions list page showing symbol, final action, confidence, strategy tag, risk summary, and creation time.
- [x] 4.3 Build the AI decision detail page showing final reasoning and per-agent opinions, with risk manager rejection visually distinguishable.
- [x] 4.4 Build the trades page showing paper/demo/manual execution source, symbol, side, quantity, price, linked reasoning, and realized outcome when available.
- [x] 4.5 Build the lessons page showing winning patterns, losing patterns, rule candidates, blocked patterns, confidence, and applied-to-skill state.
- [x] 4.6 Build the stock trading settings/status page showing configured or missing state for planned providers without rendering secrets.
- [x] 4.7 Add empty states that make it clear missing data means no internal paper data yet, not a broker account failure.

## 5. Safety And Validation

- [x] 5.1 Add tests that verify stock trading API responses never include secret values.
- [x] 5.2 Add tests that verify paper trade records are labeled as paper, demo, or manual and are not represented as real broker fills.
- [x] 5.3 Add tests or static assertions that stock trading API handlers do not invoke real broker order, cancel, transfer, or account mutation clients.
- [x] 5.4 Add route/access tests for `/admin/stock-trading` and its API routes under existing admin auth behavior.

## 6. Verification

- [x] 6.1 Add repository tests for stock trading persistence and retrieval.
- [x] 6.2 Add UI smoke or component tests for dashboard, decisions, trades, lessons, and settings empty/data states.
- [x] 6.3 Run `openspec validate add-stock-trading-mvp --strict`.
- [x] 6.4 Run `npm test`.
- [x] 6.5 Run `npm run build`.
