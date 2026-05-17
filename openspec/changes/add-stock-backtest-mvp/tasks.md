## 1. Storage And Types

- [x] 1.1 Add D1 migration and local fallback schema for stock candles, backtest runs, and simulated trades.
- [x] 1.2 Add backend and admin UI types for candles, backtest runs, simulated trades, and run requests.
- [x] 1.3 Add repository methods to upsert/list candles and create/list backtest runs with trades.

## 2. Backtest Runner

- [x] 2.1 Implement deterministic `breakout_momentum` backtest rule.
- [x] 2.2 Apply fee bps and slippage bps to simulated entries and exits.
- [x] 2.3 Compute trade count, win rate, realized PnL, average profit/loss, expectancy, Profit Factor, maximum drawdown, and date range.
- [x] 2.4 Reject runs with insufficient candle history.
- [x] 2.5 Keep backtests isolated from paper trades, positions, and portfolio snapshots.

## 3. Admin API And UI

- [x] 3.1 Add authenticated candle import/list API routes.
- [x] 3.2 Add authenticated backtest run/list/detail API routes.
- [x] 3.3 Add admin backtests page with run form and results list.
- [x] 3.4 Update dashboard summary, navigation, route exports, and business app links.

## 4. Verification

- [x] 4.1 Add storage migration tests for backtest tables.
- [x] 4.2 Add repository tests for candle upsert/list and run persistence.
- [x] 4.3 Add runner tests for profitable, no-trade, and insufficient-candle scenarios.
- [x] 4.4 Add admin route and UI tests.
- [x] 4.5 Run `openspec validate add-stock-backtest-mvp --strict`.
- [x] 4.6 Run `npm test`.
- [x] 4.7 Run `npm run build`.
