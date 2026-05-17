## Why

The stock trading MVP can display AI decisions and paper trades, but it cannot yet create them from market signals. To evaluate the AI trader safely, the platform needs a paper-only runner that consumes TradingView-style chart signals, asks an AI decision layer for a bounded recommendation, and records simulated executions without touching real broker accounts.

## What Changes

- Add a TradingView webhook endpoint for stock signals with shared-secret authentication.
- Persist incoming market signals, including symbol, timeframe, price, OHLCV payload, indicator payload, and raw webhook body.
- Add a paper-only AI decision runner that converts a signal into a structured stock AI decision.
- Add deterministic safety gates so real broker order, cancel, transfer, or account mutation APIs are never called.
- Automatically create internal paper trades only when the AI decision is actionable and passes risk checks.
- Update paper portfolio snapshots after simulated executions.
- Expose recent signals and runner status through authenticated admin API and UI surfaces.
- Add tests covering webhook auth, signal persistence, AI decision creation, paper execution, portfolio updates, and no-real-order safety.

## Capabilities

### New Capabilities
- `stock-paper-trading-runner`: Covers TradingView webhook ingestion, market signal persistence, AI decision generation, paper-only simulated execution, portfolio snapshot updates, and admin visibility.

### Modified Capabilities
None.

## Impact

- Adds D1-backed `stock_market_signals` storage and repository methods.
- Adds authenticated public webhook route under the Worker/Container path.
- Adds backend runner/service code under `src/stock-trading`.
- Extends admin API responses and UI with signal/runner visibility.
- Adds environment variables for TradingView webhook auth and paper-runner configuration.
- Does not add live broker execution or real-money trading.
