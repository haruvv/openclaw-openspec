## Context

The current stock implementation is paper-only and has these independent pieces: market data collection, candle scanning, provider candidates, candidate conversion to AI decisions, paper ledger execution, trade review, learning logs, and rulebook feedback. The missing runtime glue is a single repeatable job that moves a chart signal through that pipeline.

## Goals / Non-Goals

**Goals:**

- Run collection, scanner, and AI paper conversion as one workflow.
- Convert only eligible watch candidates above a configured score threshold.
- Reuse the existing paper-only `processStockMarketSignal` path.
- Expose a manual admin trigger and an internal authenticated scheduled-job endpoint.
- Return an auditable summary with converted/skipped/error counts.

**Non-Goals:**

- Real broker execution.
- Full cron scheduling configuration management in the UI.
- Multi-strategy optimizer.
- moomoo gateway implementation.

## Decisions

1. Extract candidate conversion into a shared helper.

   The admin candidate conversion route and automation cycle should use the same helper so status updates, price validation, and paper-only signal creation stay consistent.

2. Gate automation by provider source and score.

   The cycle converts `watch` candidates from `provider` source whose score is at or above `STOCK_TRADING_AUTO_CANDIDATE_THRESHOLD` (default `0.7`). This avoids auto-converting weaker research/manual items.

3. Use authenticated internal endpoint for scheduled execution.

   The container exposes `/internal/jobs/stock-trading-cycle` guarded by the existing integration token. Cloudflare scheduled forwarding calls it only when `STOCK_TRADING_AUTOMATION_ENABLED=true`.

## Risks / Trade-offs

- Provider outage -> collection run records failure and the cycle returns a partial/failed summary.
- Repeated candle scan -> scanner avoids re-emitting a converted provider candidate for the same latest candle.
- LLM unavailable -> existing paper runner fallback or blocking behavior remains in effect.
- Overtrading -> candidate score threshold and paper confidence threshold both apply.
