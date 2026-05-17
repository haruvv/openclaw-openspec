## 1. Storage And Domain Model

- [x] 1.1 Add stock market signal domain types, runner result types, and parsing/validation input types.
- [x] 1.2 Add `stock_market_signals` table and indexes to D1 migration and local fallback schema.
- [x] 1.3 Add repository methods to create/list market signals and return them in stock trading overview data.
- [x] 1.4 Add signal-to-decision linkage metadata without changing real broker execution semantics.

## 2. Webhook And Runner

- [x] 2.1 Add authenticated TradingView webhook route that rejects missing or invalid `TRADINGVIEW_WEBHOOK_SECRET`.
- [x] 2.2 Implement webhook payload validation and normalization for symbol, timeframe, price, strategy tag, indicators, OHLCV, and raw payload.
- [x] 2.3 Implement a paper-only decision runner that creates structured AI decisions from market signals.
- [x] 2.4 Implement conservative paper execution sizing and confidence gates for simulated `BUY`/`SELL` decisions.
- [x] 2.5 Update paper portfolio snapshots after simulated executions only.
- [x] 2.6 Ensure webhook and runner code never calls broker order, cancel, transfer, or account mutation APIs.

## 3. Admin API And UI

- [x] 3.1 Extend `/api/admin/stock-trading/overview` with recent market signals and runner status.
- [x] 3.2 Add `/api/admin/stock-trading/signals` route for recent market signals.
- [x] 3.3 Update stock trading dashboard UI to show runner status and recent signals.
- [x] 3.4 Add stock trading signals navigation/route if a separate list view is useful.
- [x] 3.5 Update settings/status UI to show TradingView webhook readiness without secrets.

## 4. Verification

- [x] 4.1 Add repository and schema tests for signal persistence and listing.
- [x] 4.2 Add webhook tests for auth, malformed payloads, valid signal processing, and no-trade outcomes.
- [x] 4.3 Add runner tests for AI decision creation, paper trade creation, and portfolio snapshot updates.
- [x] 4.4 Add UI tests for recent signals and runner status.
- [x] 4.5 Run `openspec validate add-stock-paper-trading-runner --strict`.
- [x] 4.6 Run `npm test`.
- [x] 4.7 Run `npm run build`.
