## 1. Persistence

- [x] 1.1 Add a D1 migration for stock market data watchlist entries and collection runs.
- [x] 1.2 Add local fallback schema for watchlist entries and collection runs.
- [x] 1.3 Add stock market data collector domain types.
- [x] 1.4 Add repository methods to create/list/update watchlist entries and collection runs.

## 2. Collector

- [x] 2.1 Add an HTTP candle provider client with strict response validation.
- [x] 2.2 Add the stock market data collector service that fetches enabled watchlist entries.
- [x] 2.3 Store fetched provider candles through the existing candle upsert path.
- [x] 2.4 Record successful and failed collection run audit rows.
- [x] 2.5 Keep collection read-only and separate from broker execution.

## 3. Admin API And UI

- [x] 3.1 Add admin APIs to list/create/update watchlist entries.
- [x] 3.2 Add admin APIs to list collection runs and trigger collection.
- [x] 3.3 Add admin UI types for watchlist entries and collection runs.
- [x] 3.4 Add a stock market data page with watchlist, run history, and manual collect action.
- [x] 3.5 Add navigation and dashboard links for market data collection.

## 4. Verification

- [x] 4.1 Add migration and repository tests for watchlist and run persistence.
- [x] 4.2 Add collector tests for success, missing provider, invalid response, and dedupe.
- [x] 4.3 Add admin route and UI tests for market data collection.
- [x] 4.4 Run `openspec validate add-stock-market-data-collector --strict`.
- [x] 4.5 Run focused stock/admin tests.
- [x] 4.6 Run `npm test`.
- [x] 4.7 Run `npm run build`.
