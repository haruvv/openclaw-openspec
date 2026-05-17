## Context

The stock trading app currently records AI decisions, agent opinions, TradingView market signals, paper trades, positions, portfolio snapshots, research context, and learning items. Paper SELL trades already carry realized PnL and an outcome, but the system does not automatically turn those closed-trade facts into review or learning records.

The original design explicitly calls for Review / Learning and Knowledge Curator agents after trade execution. This change implements the first production-usable version inside the existing paper-only flow.

## Goals / Non-Goals

**Goals:**

- Review completed paper trades when a SELL trade realizes PnL.
- Use linked AI decision, agent opinions, trade outcome, risk factors, strategy tag, and recent research context as review inputs.
- Persist structured learning items that show up in the Lessons API/UI.
- Make review generation idempotent per trade so webhook retries do not duplicate lessons.
- Keep deterministic fallback behavior so reviews work even when LLM credentials are unavailable.

**Non-Goals:**

- Writing files into the Codex skills repository automatically.
- Backtesting, walk-forward analysis, or strategy ranking.
- Real broker execution.
- Calling moomoo order, cancel, transfer, account, or position mutation APIs.

## Decisions

1. Review only closing SELL trades for this iteration.

   BUY trades open or add to a position and do not yet have a realized outcome. SELL trades already have `realizedPnl` and `outcome`, so they are the correct point to generate review and learning records.

2. Reuse `stock_learning_items` instead of adding a separate review table.

   The WebApp already has a Lessons surface and learning item categories. The first useful output is a set of searchable lessons linked to `source_trade_id`. A separate review table can be added later if we need rich transcript storage.

3. Make learning IDs deterministic.

   Generate IDs from the trade ID and learning category slot. If a webhook retry or manual reprocessing attempts to review the same trade, the repository can skip items that already exist for that trade and avoid duplicate visible lessons.

4. Prefer a deterministic reviewer, with optional LLM later.

   LLM decision generation already exists. For review learning, deterministic output based on PnL, outcome, decision, agents, and risk factors is enough to create reliable product behavior now. This avoids latency and fragility in the webhook close path.

5. Keep paper-only safety at the code boundary.

   The review flow observes persisted paper trade data and writes learning records only. It does not affect broker integrations or create trades.

## Risks / Trade-offs

- Deterministic reviews are less nuanced than a full LLM review. Mitigation: include the most important facts now and keep the function boundary ready for future LLM enhancement.
- Learning records may be too coarse for strategy optimization. Mitigation: include category, source trade, confidence, and body text so later strategy metrics can reuse them.
- Existing SELL quantity handling uses fixed notional sizing, so partial close reviews may represent a partial outcome. Mitigation: review every realized SELL trade and title it as a trade outcome, not a full campaign result.
