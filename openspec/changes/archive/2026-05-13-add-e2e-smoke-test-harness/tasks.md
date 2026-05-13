## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal, design, and `e2e-smoke-validation` spec artifacts.
- [x] 1.2 Validate the new change with `openspec validate add-e2e-smoke-test-harness`.

## 2. Smoke Harness Implementation

- [x] 2.1 Add smoke result types and report persistence helpers.
- [x] 2.2 Implement the one-target smoke orchestration with pass/fail/skip step handling.
- [x] 2.3 Add safe opt-in gates for SendGrid, Slack, and Stripe side-effecting steps.
- [x] 2.4 Add a CLI entry point that accepts an optional target URL and writes a report.

## 3. Configuration

- [x] 3.1 Add `smoke:e2e` npm script.
- [x] 3.2 Document smoke environment variables in `.env.example`.

## 4. Tests

- [x] 4.1 Add unit tests for skipped side-effect behavior.
- [x] 4.2 Add unit tests for report persistence and summary output.

## 5. Verification

- [x] 5.1 Run `npm test`.
- [x] 5.2 Run `npm run build`.
- [x] 5.3 Run `openspec validate --all`.
- [x] 5.4 Review `git diff` for intended scope.
