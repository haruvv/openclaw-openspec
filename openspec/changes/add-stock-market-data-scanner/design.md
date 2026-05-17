## Context

TradingView alerts can already create paper AI decisions, and research/manual inputs can create candidates. Provider candles now accumulate in `stock_candles`, but there is no app-side scanner that turns those candles into Market Scanner output.

## Goals / Non-Goals

**Goals:**

- Scan enabled market data watchlist entries using stored candles.
- Create provider-sourced candidates when recent price/volume action matches a simple breakout momentum pattern.
- Preserve existing candidate review and conversion workflow.
- Keep the scanner deterministic and testable.

**Non-Goals:**

- Add complex multi-strategy optimization.
- Automatically convert every candidate into a trade.
- Use unavailable fundamentals/news in scanner scoring.
- Place real broker orders.

## Decisions

1. Use existing candles and candidates.

   The scanner reads `stock_candles` and upserts `stock_market_candidates` with `source: "provider"`. No new storage is required for the MVP.

2. Start with breakout momentum.

   A watchlist entry becomes a candidate when the latest close is above the previous high over a short lookback and latest volume is above the recent average. This directly supports the design's "出来高増加を伴う高値更新" example.

3. Keep scanner explainable.

   Candidate `reason`, `score`, and `rawPayload` include close, previous high, latest volume, average volume, and provider/timeframe. This makes the scanner output reviewable before AI decision conversion.

## Risks / Trade-offs

- Simple scanner can be noisy -> candidates remain in `watch` status until reviewed or converted.
- Insufficient candles -> skip entry and return skipped count.
- Upsert by symbol/source can replace older provider candidate -> acceptable for latest watch candidate MVP.
