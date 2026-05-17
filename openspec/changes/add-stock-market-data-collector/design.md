## Context

The app already has `stock_candles`, manual candle import, backtests, TradingView webhook signals, scanner candidates, and paper AI decisions. What is missing from the design document's MVP is a repeatable market data collector that keeps price history current without relying on manual JSON import.

Production Cloudflare deployment cannot assume a local SDK process is available, and moomoo OpenAPI often requires a local gateway/bridge. This change therefore treats moomoo as an HTTP provider endpoint configured by environment, while keeping the app-side collector provider-agnostic and testable.

## Goals / Non-Goals

**Goals:**

- Persist a stock data watchlist with symbols and timeframes to collect.
- Fetch OHLCV candles from a configured HTTP provider endpoint.
- Store fetched candles in the existing `stock_candles` table using existing upsert semantics.
- Record collection run status, counts, and error messages.
- Allow operators to run the collector from the admin UI and inspect latest results.

**Non-Goals:**

- Implement the moomoo gateway itself.
- Place real broker orders or call account/position mutation APIs.
- Stream ticks/websockets directly into Cloudflare.
- Replace TradingView alerts or manual candle import.
- Automatically run Cloudflare cron in this change; on-demand admin execution is the MVP.

## Decisions

1. Add watchlist and collection run tables.

   Watchlist rows store symbol, timeframe, provider, enabled flag, lookback limit, timestamps, and optional notes. Collection runs store provider, status, requested/completed counts, inserted/updated candle counts, error, and run timestamps. This gives operators auditability without changing the existing candle schema.

2. Use an HTTP candle provider abstraction.

   The collector accepts a provider client interface. The production client calls `STOCK_MARKET_DATA_PROVIDER_URL` with query parameters for symbol, timeframe, and limit. Tests can inject a local fake provider. This avoids baking in unverified moomoo SDK details while leaving a clean bridge point for moomoo.

3. Store provider data through existing candle ingestion.

   The collector normalizes provider candles into `CreateStockCandleInput[]` and calls the repository upsert path. Backtests and future AI context then consume the same `stock_candles` data regardless of source.

4. Start with operator-triggered collection.

   The admin API exposes a POST endpoint to collect enabled watchlist entries. A future cron can call the same function. This keeps the first production path explicit and easy to observe.

## Risks / Trade-offs

- Provider response shape mismatch -> Validate response JSON strictly and record failed run errors without partial hidden success.
- Bridge endpoint unavailable -> Mark run failed, keep previous candles, and show the error in admin UI.
- Duplicate candles -> Reuse existing symbol/timeframe/timestamp upsert key.
- Too much data per run -> Watchlist entries have a bounded `lookbackLimit`.
- moomoo auth details are unknown -> Keep credentials outside this app and behind a bridge endpoint; do not invent unsupported SDK behavior.

## Migration Plan

1. Add D1 migration and local fallback schema for watchlist and collection runs.
2. Deploy schema before enabling any provider URL.
3. Operators add watchlist rows from the admin UI or API.
4. Operators trigger collection manually and inspect run status.
5. Rollback is safe by disabling watchlist rows or unsetting `STOCK_MARKET_DATA_PROVIDER_URL`; existing candles remain usable.
