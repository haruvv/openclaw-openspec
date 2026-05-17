## Why

The stock trading app can now run paper trades, review outcomes, and report strategy performance, but strategy rules still cannot be tested against historical price data before live paper execution. The original design requires backtesting so operators can reject weak rules before they influence future AI decisions.

## What Changes

- Add historical OHLCV candle persistence for stock symbols and timeframes.
- Add a deterministic backtest runner for simple strategy rules using stored candles.
- Persist backtest run summaries and simulated trades.
- Expose backtest runs through authenticated admin API and UI.
- Keep backtests read-only/reporting-only; no broker orders, paper positions, or live trading state are mutated.

## Capabilities

### New Capabilities

- `stock-backtest-mvp`: Stores historical candles, runs deterministic backtests, and displays backtest metrics.

### Modified Capabilities

None.

## Impact

- Adds D1 migration and local fallback schema for candles and backtest runs.
- Adds stock backtest domain types, repository methods, and runner logic.
- Adds admin API routes for importing candles and running/listing backtests.
- Adds admin UI page for backtest runs and manual candle/backtest execution.
- Adds storage, repository, runner, route, and UI tests.
