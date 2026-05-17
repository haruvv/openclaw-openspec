## Why

The app can now collect provider candles, but those candles do not yet produce AI watch candidates. The design expects Market Scanner Agent to turn chart and volume conditions into symbols the AI investment meeting can evaluate.

## What Changes

- Add a stock market data scanner that analyzes collected candles for enabled watchlist entries.
- Detect breakout momentum candidates using recent high breakout and volume expansion.
- Upsert detected candidates into the existing `stock_market_candidates` table with `source: "provider"`.
- Add admin API and UI action to run the scan after collection.
- Keep scanner output as paper-only candidate context; it does not place trades.

## Capabilities

### New Capabilities
- `stock-market-data-scanner`: Converts collected candle history into Market Scanner candidates for AI paper-trading review.

### Modified Capabilities
None.

## Impact

- Adds a scanner service over existing candle/watchlist/candidate repositories.
- Extends admin API and stock market data UI.
- Adds scanner, admin route, and UI tests.
