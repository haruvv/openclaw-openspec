## 1. Storage And Domain Model

- [x] 1.1 Add stock research context domain types and input types.
- [x] 1.2 Add `stock_research_items` D1 migration and local fallback schema.
- [x] 1.3 Add repository methods to create and list research context.
- [x] 1.4 Include recent research context in stock trading overview.

## 2. LLM Runner Integration

- [x] 2.1 Load symbol-specific and market-wide research context for LLM decisions.
- [x] 2.2 Add research context to the LLM decision payload.
- [x] 2.3 Keep unavailable-context markers when no research exists.

## 3. Admin API And UI

- [x] 3.1 Add admin API routes to list and create stock research items.
- [x] 3.2 Add research context panel to stock trading dashboard.
- [x] 3.3 Add research context page with simple manual create form.
- [x] 3.4 Update navigation and UI types.

## 4. Verification

- [x] 4.1 Add schema and repository tests for research persistence.
- [x] 4.2 Add LLM runner tests for research context prompt injection.
- [x] 4.3 Add admin route and UI tests.
- [x] 4.4 Run `openspec validate add-stock-research-context --strict`.
- [x] 4.5 Run `npm test`.
- [x] 4.6 Run `npm run build`.
