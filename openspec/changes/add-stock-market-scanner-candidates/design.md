## Context

The current stock runner processes a symbol after a TradingView alert or manual candle/backtest data exists. This covers the middle of the design document's flow, but not the beginning: Market Scanner should identify symbols/themes worth monitoring before the full agent meeting.

The first implementation should not pretend to have complete moomoo sector flow or news-provider coverage. It should create the durable candidate layer and use available signals/research as candidate sources. Later provider integrations can write into the same table.

## Goals / Non-Goals

**Goals:**

- Persist candidate symbols with theme, sector, score, source, reason, and status.
- Create or refresh candidates from TradingView signals and stock research items.
- Show candidates in the stock trading UI.
- Let an operator reject, approve/watch, or convert a candidate into a paper-only AI decision.
- Keep all conversion paths paper-only and behind existing decision/risk/ledger gates.

**Non-Goals:**

- Real broker execution.
- Full moomoo market scanner integration.
- Autonomous scheduled universe scanning.
- Complex duplicate-resolution across all market data providers.
- A separate asynchronous multi-agent market scan job.

## Decisions

1. Use one candidate table with upsert-by-symbol/source.

   Candidate discovery can come from TradingView, research, or future providers. A unique `(symbol, source)` key lets each source update its own view without dropping provenance.

2. Candidate status is operator-friendly.

   Statuses are `watch`, `approved`, `rejected`, and `converted_to_decision`. `watch` is the default. `approved` means the candidate remains worth monitoring. `converted_to_decision` records that the candidate has been promoted into an AI investment meeting.

3. Candidate conversion reuses market signal processing.

   The conversion endpoint creates a synthetic TradingView-style market signal from candidate data and calls the existing paper runner. This avoids a second decision path and preserves risk gates, learning feedback, and paper-only execution.

4. Candidate generation is intentionally conservative.

   TradingView candidates use the alert's strategy/action/indicators. Research candidates use operator-entered research category, sentiment, importance, and summary. The system does not invent sector/theme beyond what is available.

## Risks / Trade-offs

- Candidate quality is limited by current inputs → Make source and reason visible, and allow rejection.
- Synthetic signal conversion can lack rich chart data → Include candidate metadata and require existing confidence/risk gates to decide whether to trade.
- Repeated alerts may overwrite candidate details → Preserve the latest candidate view while keeping raw payload and timestamps for provenance.
- This is not yet a true moomoo scanner → The table/API/UI contract is built so moomoo ingestion can be added next.

## Migration Plan

1. Add `stock_market_candidates` migration and local fallback schema.
2. Existing installations start with an empty candidate list.
3. New TradingView signals and research entries begin populating candidates.
4. Rollback is safe because candidates are advisory and not required for paper runner execution.
