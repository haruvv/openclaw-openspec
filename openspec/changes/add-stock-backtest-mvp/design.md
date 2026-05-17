## Context

The stock trading app already records paper decisions, trades, positions, research, reviews, and strategy performance. It still lacks historical candle storage and a way to test strategy rules before they are allowed to influence live paper decisions. Production storage is D1/R2 through the durable HTTP bridge; SQLite remains only the local/test fallback.

## Goals / Non-Goals

**Goals:**

- Store normalized OHLCV candles by symbol and timeframe.
- Run deterministic backtests against stored candles.
- Persist backtest summaries and simulated trades.
- Display backtest history and metrics in the stock trading admin UI.
- Keep all backtest behavior reporting-only and isolated from paper/live execution state.

**Non-Goals:**

- Integrating moomoo, TDnet, EDINET, or paid market data providers in this change.
- Building a full parameter optimizer or walk-forward engine.
- Using future data, news after the candle timestamp, or live broker state in backtests.
- Placing real or paper orders from a backtest.

## Decisions

1. Add candle and backtest tables.

   Candles and backtest results are durable product data. Storing them lets operators import historical data manually now and lets future collectors write to the same tables later.

2. Use one deterministic MVP strategy rule.

   The runner supports `breakout_momentum` first: enter long when close breaks above the previous lookback high and volume is above average, then exit on take-profit, stop-loss, or max holding bars. This maps to the existing strategy tags and is testable.

3. Persist simulated trades separately from paper trades.

   Backtest trades are historical simulations and must not affect positions, portfolio snapshots, paper trade logs, or learning review flow.

4. Include fees/slippage settings in run parameters.

   The original design warns that backtests without costs are misleading. The MVP records fee bps and slippage bps and applies them to each simulated round trip.

5. Keep imports manual/API-first.

   External collectors are future work. Admin API/UI can add candle batches so the backtest engine is usable immediately without network dependencies.

## Risks / Trade-offs

- Manual candle imports can be incomplete. Mitigation: backtest runs record candle count and date range.
- One MVP strategy is narrow. Mitigation: store strategy ID and params JSON so more strategies can be added without schema churn.
- Simple bar-based execution is approximate. Mitigation: apply slippage and fees and keep simulated trades clearly separate from actual paper trades.
