## 1. Storage And Domain Model

- [x] 1.1 Add stock position domain types and ledger result types.
- [x] 1.2 Add `stock_positions` D1 migration and local fallback schema.
- [x] 1.3 Add repository methods to list/get positions and apply paper fills with average-cost accounting.
- [x] 1.4 Extend portfolio metrics and overview to include ledger-derived positions and equity.

## 2. Paper Runner Integration

- [x] 2.1 Replace cash-only snapshot updates with ledger-backed paper execution.
- [x] 2.2 Block paper SELL executions when quantity exceeds the current paper position.
- [x] 2.3 Ensure blocked position-risk decisions create no trade or snapshot.
- [x] 2.4 Preserve paper-only safety boundaries and broker non-mutation behavior.

## 3. Admin API And UI

- [x] 3.1 Extend stock trading API responses with open positions.
- [x] 3.2 Update dashboard UI to show open positions and empty state.
- [x] 3.3 Update admin UI types and tests for position metrics.

## 4. Verification

- [x] 4.1 Add schema tests for `stock_positions`.
- [x] 4.2 Add repository tests for buy, average entry, sell, realized PnL, and oversell blocking.
- [x] 4.3 Add paper runner tests for ledger-backed BUY and blocked SELL.
- [x] 4.4 Run `openspec validate add-stock-paper-position-ledger --strict`.
- [x] 4.5 Run `npm test`.
- [x] 4.6 Run `npm run build`.
