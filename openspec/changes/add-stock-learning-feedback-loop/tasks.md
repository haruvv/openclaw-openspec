## 1. Persistence

- [x] 1.1 Add a D1 migration for stock decision learning references.
- [x] 1.2 Add the local fallback schema for stock decision learning references.
- [x] 1.3 Add stock repository methods to select recent lessons for decision context.
- [x] 1.4 Add stock repository methods to attach and read decision learning references.

## 2. Runner Feedback Loop

- [x] 2.1 Load bounded learning context before building an LLM decision payload.
- [x] 2.2 Include learning context in the LLM decision payload with paper-only framing.
- [x] 2.3 Persist selected learning refs after saving an AI decision.
- [x] 2.4 Keep deterministic fallback, risk veto, confidence gates, and paper ledger behavior intact.

## 3. Admin UI

- [x] 3.1 Extend stock decision detail API and types with attached learning items.
- [x] 3.2 Show attached learning context on the decision detail page.
- [x] 3.3 Render an empty state for decisions with no attached lessons.

## 4. Verification

- [x] 4.1 Add repository tests for decision learning ref persistence and dedupe.
- [x] 4.2 Add runner tests for learning context prompt injection.
- [x] 4.3 Add UI tests for attached learning visibility.
- [x] 4.4 Run `openspec validate add-stock-learning-feedback-loop --strict`.
- [x] 4.5 Run focused stock/admin tests.
- [x] 4.6 Run `npm run build`.
