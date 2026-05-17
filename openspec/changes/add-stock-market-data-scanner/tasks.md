## 1. Scanner

- [x] 1.1 Add a stock market data scanner service over enabled watchlist entries.
- [x] 1.2 Detect breakout momentum from stored candles using previous high and average volume.
- [x] 1.3 Upsert provider-sourced market candidates with explainable raw payload.
- [x] 1.4 Return created and skipped counts without broker side effects.

## 2. Admin API And UI

- [x] 2.1 Add an admin API to trigger market data scanning.
- [x] 2.2 Add a scan action to the stock market data UI.
- [x] 2.3 Refresh candidate/market-data views after scan.

## 3. Verification

- [x] 3.1 Add scanner service tests for created and skipped candidates.
- [x] 3.2 Add admin route and UI tests for scanner trigger.
- [x] 3.3 Run `openspec validate add-stock-market-data-scanner --strict`.
- [x] 3.4 Run focused stock/admin tests.
- [x] 3.5 Run `npm test`.
- [x] 3.6 Run `npm run build`.
