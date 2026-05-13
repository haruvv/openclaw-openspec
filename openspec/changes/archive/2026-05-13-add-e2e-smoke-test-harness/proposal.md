## Why

The pipeline currently passes unit tests with mocks, but its riskiest failure modes live at external service boundaries: Firecrawl, Lighthouse/Chromium, LLM generation, SendGrid, Slack, and Stripe. A smoke harness gives operators one safe command to verify which integrations are actually usable in the current environment.

## What Changes

- Add an E2E smoke harness that can run a single-target pipeline validation from the command line.
- Record each step as passed, failed, or skipped with timing, errors, and output artifacts.
- Add safe dry-run behavior for side-effecting providers so the smoke test can run without accidentally emailing prospects or charging customers.
- Persist smoke run reports under `output/smoke-runs/<timestamp>.json`.
- Add npm scripts for smoke execution.

## Capabilities

### New Capabilities

- `e2e-smoke-validation`: Defines the operator-facing smoke test harness for validating real integration readiness.

### Modified Capabilities

None.

## Impact

- New smoke harness source under `src/smoke/`.
- Package scripts in `package.json`.
- Environment documentation in `.env.example`.
- Tests for smoke step orchestration, skipped-provider behavior, and report persistence.
