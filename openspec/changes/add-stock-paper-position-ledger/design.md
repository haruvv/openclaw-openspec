## Context

The stock paper runner can receive TradingView signals and create paper trades, but the simulated account state is still snapshot-only. The snapshot currently adjusts cash around a trade without tracking open quantity, average entry price, realized PnL from sells, or mark-to-market exposure. That makes the dashboard useful for activity, but weak for evaluating whether the demo trader is actually managing a paper account.

Production persistence is Cloudflare D1 through the durable-http bridge. SQLite is only the local/test fallback. The feature must preserve the paper-only safety boundary and must not introduce broker mutations.

## Goals / Non-Goals

**Goals:**

- Track per-symbol paper positions with quantity, average entry price, realized PnL, last mark price, and timestamps.
- Apply paper BUY/SELL fills to the position ledger before capturing portfolio snapshots.
- Derive cash, realized PnL, unrealized PnL, total equity, win rate, and max drawdown from ledger-aware paper state.
- Block paper SELL requests that exceed the currently held demo quantity.
- Expose open positions in admin overview/API/UI without exposing any secret values.

**Non-Goals:**

- Real broker order placement, cancellation, transfer, or account reconciliation.
- Multi-currency accounting, fees, taxes, slippage, borrow costs, or short selling.
- Historical candle storage or independent price-feed ingestion.
- Full backtest engine or strategy optimizer.

## Decisions

1. Store one mutable row per symbol in `stock_positions`.

   The paper runner needs fast current-state reads and simple UI rendering. One row per symbol is enough for average-cost accounting and keeps D1 queries straightforward. Individual fills remain in `stock_trades`, so the audit trail is not lost.

2. Use average-cost accounting for long-only paper positions.

   BUY increases quantity and recalculates weighted average entry price. SELL reduces quantity and realizes `(sell price - average entry price) * sold quantity`. This matches the current MVP scope and avoids lot-selection complexity. Short selling is blocked for now.

3. Treat the latest trade price as the position mark.

   The system does not yet have a continuous market-data stream. The latest signal/execution price is the most honest available mark. Later market-data integration can update marks without changing the portfolio metrics contract.

4. Make ledger updates transactional where the storage backend allows it.

   SQLite can update position, trade, and snapshot inside a local transaction. The durable-http bridge already accepts batched SQL calls, but returning computed rows after conditional updates is simpler as repository-level steps for this scope. Tests cover behavior rather than relying on backend-specific transactions.

5. Keep snapshots as derived audit points.

   Snapshots remain useful for equity curve and drawdown history, but they should be derived from current cash and positions. The ledger becomes the source of truth for open exposure.

## Risks / Trade-offs

- Partial failure between trade and position update could make a durable-http paper fill inconsistent. Mitigation: keep the operation in one repository helper where possible and verify with tests; later harden the durable bridge with transactional batch semantics if needed.
- Average-cost accounting hides per-lot performance. Mitigation: `stock_trades` still stores every fill; lot accounting can be added later.
- Mark-to-market uses the latest received price, not a live quote. Mitigation: label this as paper simulation and preserve mark timestamps.
- Existing manually created snapshots may not correspond to positions. Mitigation: portfolio metrics prefer ledger-aware data when positions exist and continue to handle empty/legacy state.

## Migration Plan

1. Add `stock_positions` table and indexes through a new D1 migration and local fallback schema.
2. Add repository types and methods to list/get/upsert positions and apply a paper fill.
3. Update the paper runner to use the ledger helper instead of simple cash-only snapshot logic.
4. Extend admin overview/signals UI types and dashboard with open positions.
5. Add migration, repository, runner, API, and UI tests.

Rollback is safe: disabling the runner stops new position updates. Existing trade and snapshot records remain readable, and the position table can stay unused.
