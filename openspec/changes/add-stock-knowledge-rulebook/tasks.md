## 1. Persistence

- [x] 1.1 Add a D1 migration for stock trading rules.
- [x] 1.2 Add local fallback schema for stock trading rules.
- [x] 1.3 Add stock trading rule domain types.
- [x] 1.4 Add repository methods to create, list, and update rule status.

## 2. Knowledge Loop

- [x] 2.1 Create rule candidates when stock learning items are saved.
- [x] 2.2 Deduplicate rule candidates by source learning item.
- [x] 2.3 Include active rules in LLM stock decision payloads.
- [x] 2.4 Keep deterministic fallback and paper-only gates unchanged.

## 3. Admin API And UI

- [x] 3.1 Add admin APIs to list rules and update rule status.
- [x] 3.2 Add rulebook types to admin UI.
- [x] 3.3 Add a stock rulebook page with activate/reject controls.
- [x] 3.4 Add recent rules to the stock dashboard and navigation.

## 4. Verification

- [x] 4.1 Add repository tests for rule extraction, dedupe, and status updates.
- [x] 4.2 Add runner tests for active rule prompt injection.
- [x] 4.3 Add admin route and UI tests for rulebook management.
- [x] 4.4 Run `openspec validate add-stock-knowledge-rulebook --strict`.
- [x] 4.5 Run focused stock/admin tests.
- [x] 4.6 Run `npm test`.
- [x] 4.7 Run `npm run build`.
