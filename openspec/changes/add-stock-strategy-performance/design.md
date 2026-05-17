## Context

Paper trades already link back to AI decisions, and decisions can carry a `strategy_tag`. Completed SELL trades already store realized PnL and outcome. This means strategy performance can be derived from existing data without adding another persistence table.

## Goals / Non-Goals

**Goals:**

- Aggregate completed paper trade outcomes by strategy tag.
- Show metrics that matter for strategy evaluation: win rate, expectancy, Profit Factor, realized PnL, average win/loss, trade count, and recent activity.
- Make untagged trades visible as an explicit unclassified bucket.
- Expose the metrics in admin API and UI.

**Non-Goals:**

- Backtesting or historical candle simulation.
- Persisting strategy score snapshots.
- Automatically adopting, rejecting, or mutating strategy rules.
- Real broker execution.

## Decisions

1. Derive metrics from existing trade and decision rows.

   Completed paper trades are the source of truth. Joining `stock_trades.decision_id` to `stock_ai_decisions.id` gives the strategy tag. This avoids a migration and keeps the dashboard consistent with current trade logs.

2. Count only closed trades for performance metrics.

   BUY trades and open outcomes do not have realized PnL. Strategy performance should use SELL trades with non-null realized PnL and non-open outcomes.

3. Keep unclassified trades visible.

   If a decision does not have `strategy_tag`, the system should display `unclassified` rather than dropping the trade. This exposes missing tagging discipline.

4. Use simple status labels as reporting hints.

   The UI can show `adopt`, `watch`, or `reject` based on sample size and metrics, but these labels are informational only. They do not alter execution behavior.

## Risks / Trade-offs

- Small sample sizes can mislead. Mitigation: show trade count and use `watch` when there are too few trades.
- Partial exits count as separate realized trades. Mitigation: this matches the current ledger behavior and is acceptable until full campaign-level analysis exists.
- Metrics are current-state derived, not historical snapshots. Mitigation: this is enough for MVP strategy visibility; snapshots can be added later.
