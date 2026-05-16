## 1. Diagnostic Contracts

- [x] 1.1 Add shared diagnostic types and helpers for sanitized failure details.
- [x] 1.2 Update revenue-agent step result typing to allow structured failure diagnostics in details.

## 2. Lighthouse Diagnostics

- [x] 2.1 Make Lighthouse timeout configurable and increase the default for production container execution.
- [x] 2.2 Return structured Lighthouse success/failure results including timeout, process, and parse errors.
- [x] 2.3 Add Chrome flags needed for more stable container execution.

## 3. Crawler And Run Integration

- [x] 3.1 Record Lighthouse fallback warnings in crawler results and run outputs.
- [x] 3.2 Preserve crawler skip details for crawl and opportunity filtering failures.
- [x] 3.3 Persist structured diagnostics for failed or skipped run steps and log failures with run context.

## 4. Verification

- [x] 4.1 Update crawler tests for Lighthouse fallback warning details.
- [x] 4.2 Add or update revenue-agent tests for failed/skipped step diagnostics.
- [x] 4.3 Run lint, tests, build, and OpenSpec validation.
