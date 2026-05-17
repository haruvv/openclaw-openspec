## Why

The stock trading workflow can react to TradingView alerts and manually imported candles, but it still lacks the market data collector described in `docs/stack/stack-trade-design.md`. Without a collector, the app cannot continuously build its own price history or use provider data as a repeatable input for scanner, backtest, and AI decision workflows.

## What Changes

- Add a stock market data collector that fetches OHLCV candles from a configured provider endpoint and stores them in the existing `stock_candles` table.
- Add a watchlist configuration so operators can choose which symbols/timeframes are collected.
- Add an admin API to run the collector on demand and inspect recent collection runs.
- Add an admin UI panel/page for market data collection status, watchlist entries, and manual run controls.
- Keep the collector provider-agnostic for now: moomoo can be connected through a configured HTTP bridge endpoint, while tests use deterministic local fixtures.

## Capabilities

### New Capabilities
- `stock-market-data-collector`: Collects external market candles for configured stock watchlist entries and exposes collection status to operators.

### Modified Capabilities
None.

## Impact

- Adds D1/local schema for watchlist entries and collection runs.
- Extends stock trading repository with watchlist, collector run, and candle ingestion helpers.
- Adds a provider abstraction and HTTP candle provider client.
- Extends admin stock APIs and UI.
- Adds repository, collector, route, UI, and migration tests.
