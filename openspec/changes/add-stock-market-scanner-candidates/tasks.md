## 1. Persistence

- [x] 1.1 Add a D1 migration for stock market scanner candidates.
- [x] 1.2 Add the local fallback schema for stock market scanner candidates.
- [x] 1.3 Add stock candidate domain types and input types.
- [x] 1.4 Add repository methods to upsert, list, get, and update candidate status.

## 2. Candidate Creation

- [x] 2.1 Create or refresh a candidate when a TradingView signal is processed.
- [x] 2.2 Create or refresh a candidate when symbol-specific research is saved.
- [x] 2.3 Add candidate-to-paper-decision conversion using the existing paper runner.
- [x] 2.4 Keep conversion paper-only and reuse existing risk and ledger gates.

## 3. Admin API And UI

- [x] 3.1 Add admin APIs to list candidates, update status, and convert a candidate.
- [x] 3.2 Add candidate types to the admin UI.
- [x] 3.3 Add a stock market candidates page.
- [x] 3.4 Add candidates to stock dashboard and stock navigation.

## 4. Verification

- [x] 4.1 Add repository tests for candidate persistence and status updates.
- [x] 4.2 Add runner tests for TradingView candidate creation and conversion.
- [x] 4.3 Add admin route and UI tests for candidates.
- [x] 4.4 Run `openspec validate add-stock-market-scanner-candidates --strict`.
- [x] 4.5 Run focused stock/admin tests.
- [x] 4.6 Run `npm test`.
- [x] 4.7 Run `npm run build`.
