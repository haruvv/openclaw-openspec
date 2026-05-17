## 1. Repository Support

- [x] 1.1 Add repository helpers to retrieve learning items by source trade.
- [x] 1.2 Add repository helpers to retrieve a trade by ID if needed for review tests.
- [x] 1.3 Ensure duplicate learning records for the same trade can be detected.

## 2. Review Generation

- [x] 2.1 Add a stock trade review module or runner function.
- [x] 2.2 Generate winning, losing, flat, and strategy-note learning items from completed SELL trades.
- [x] 2.3 Include linked decision, agent, risk-factor, strategy, and research context in review output.
- [x] 2.4 Keep BUY/open trades from producing completed-trade lessons.
- [x] 2.5 Make review generation idempotent for webhook retries.

## 3. Paper Runner Integration

- [x] 3.1 Trigger review after successful paper SELL execution.
- [x] 3.2 Return or expose review-created learning items where useful without changing real-order behavior.
- [x] 3.3 Preserve paper-only safety boundaries.

## 4. UI/API Visibility

- [x] 4.1 Ensure Lessons API/UI shows review-generated learning items with source trade links.
- [x] 4.2 Update UI types or rendering if review output needs additional fields.

## 5. Verification

- [x] 5.1 Add repository tests for source-trade learning lookup and duplicate detection.
- [x] 5.2 Add runner tests for winning and losing SELL review generation.
- [x] 5.3 Add tests that BUY/open trades do not create completed-trade lessons.
- [x] 5.4 Add tests that review output includes decision, agent, risk, and research context.
- [x] 5.5 Run `openspec validate add-stock-trade-review-learning --strict`.
- [x] 5.6 Run `npm test`.
- [x] 5.7 Run `npm run build`.
