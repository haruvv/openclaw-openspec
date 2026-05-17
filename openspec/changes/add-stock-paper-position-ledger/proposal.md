## Why

The current stock paper runner records a signal, decision, trade, and simple portfolio snapshot, but it does not maintain open positions or calculate realized/unrealized PnL from those positions. Without a position ledger, demo trading cannot be evaluated reliably because cash, exposure, wins, and risk are only approximate.

## What Changes

- Add a paper-only stock position ledger that tracks per-symbol quantity, average entry price, realized PnL, and last mark price.
- Update paper execution so BUY increases or opens a position and SELL reduces an existing position before creating a portfolio snapshot.
- Block paper SELL executions that exceed the currently held demo quantity.
- Calculate portfolio metrics from cash, open positions, realized PnL, and latest marks instead of relying only on manually supplied snapshot values.
- Expose open positions in the admin API and UI.
- Keep the system paper-only; no broker order, account mutation, or transfer APIs are introduced.

## Capabilities

### New Capabilities
- `stock-paper-position-ledger`: Tracks internal paper positions and derives portfolio metrics from simulated executions.

### Modified Capabilities
None.

## Impact

- Adds a D1 migration and local fallback schema for `stock_positions`.
- Updates stock trading repository types, persistence, portfolio metric calculation, and runner execution flow.
- Extends admin stock trading overview responses and UI with open positions.
- Adds repository, runner, migration, route, and UI tests for position-ledger behavior.
