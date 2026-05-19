## 1. Core Workflow

- [x] 1.1 Extract candidate conversion into a reusable paper-only helper.
- [x] 1.2 Add autonomous stock paper cycle service.
- [x] 1.3 Convert only eligible provider watch candidates above threshold.
- [x] 1.4 Return collection, scan, conversion, skipped, and error summary.
- [x] 1.5 Avoid re-scanning a converted provider candidate for the same latest candle.

## 2. API, Internal Job, And UI

- [x] 2.1 Add admin API to run the autonomous paper cycle.
- [x] 2.2 Add authenticated internal job handler for stock paper cycle.
- [x] 2.3 Wire server and Cloudflare scheduled forwarding.
- [x] 2.4 Add admin UI button and summary state.

## 3. Verification

- [x] 3.1 Add service tests for eligible, skipped, and failed cycle behavior.
- [x] 3.2 Add route and UI tests for manual/internal triggers.
- [x] 3.3 Run `openspec validate add-stock-autonomous-paper-cycle --strict`.
- [x] 3.4 Run focused stock/admin tests.
- [x] 3.5 Run `npm test`.
- [x] 3.6 Run `npm run build`.
