## 1. Runner

- [x] 1.1 Add an exit review runner function for open paper positions.
- [x] 1.2 Build synthetic exit review signal context from position facts.
- [x] 1.3 Reuse existing AI decision, risk, confidence, ledger, and learning paths.
- [x] 1.4 Avoid market scanner candidate creation for exit review signals.

## 2. Admin API And UI

- [x] 2.1 Add an admin API route to trigger position exit reviews.
- [x] 2.2 Add an Exit review action to open positions in the stock dashboard.
- [x] 2.3 Show errors when a position cannot be reviewed.
- [x] 2.4 Refresh dashboard data after an exit review completes.

## 3. Verification

- [x] 3.1 Add runner tests for open position exit reviews.
- [x] 3.2 Add admin route tests for exit review success and missing-position errors.
- [x] 3.3 Add UI tests for the Exit review action.
- [x] 3.4 Run `openspec validate add-stock-position-exit-monitor --strict`.
- [x] 3.5 Run focused stock/admin tests.
- [x] 3.6 Run `npm test`.
- [x] 3.7 Run `npm run build`.
