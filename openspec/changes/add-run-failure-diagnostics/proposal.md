## Why

Production runs can fail or degrade because of external providers, container runtime behavior, Lighthouse/Chromium startup, network timeouts, or missing credentials, but the current run history often records only a short message such as "No target produced" or a generic provider error. Operators need enough structured, secret-safe diagnostic detail in run logs to distinguish transient provider/runtime failures from target-site issues and configuration problems.

## What Changes

- Increase Lighthouse tolerance for slow production execution and make the timeout configurable.
- Persist structured Lighthouse failure diagnostics when measurement fails, while still allowing crawl-only fallback analysis to continue.
- Add structured, secret-safe failure diagnostics to run step details for failed and skipped steps.
- Log step failures with run ID, step name, duration, error class, sanitized message, and retry-oriented reason metadata.
- Surface crawler skip and fallback reasons in persisted run outputs/details so admin run history can explain what happened without reading container stdout.
- Keep existing API response shapes backward compatible by adding optional diagnostic fields rather than replacing existing `error`, `reason`, or `details` fields.

## Capabilities

### New Capabilities
- `run-failure-diagnostics`: Defines structured, persisted diagnostics for run steps, provider failures, crawler skips, and degraded fallback execution.

### Modified Capabilities
- `site-crawler`: Lighthouse measurement must expose timeout/process/parse failure reasons and support crawl-only fallback diagnostics.
- `e2e-smoke-validation`: Smoke validation and run reporting must preserve step-level diagnostic detail for failures and skips.

## Impact

- Affected code:
  - `src/site-crawler/lighthouse-runner.ts`
  - `src/site-crawler/crawler.ts`
  - `src/revenue-agent/runner.ts`
  - `src/revenue-agent/types.ts`
  - tests covering crawler, run reports, and smoke behavior
- Affected data:
  - Existing run step rows remain readable.
  - New runs may include optional diagnostic objects in step `details` and crawl `outputs`.
- Affected operations:
  - Operators can inspect admin run details or stored run JSON to see whether Lighthouse timed out, Chrome failed, provider credentials were missing, or a provider API call failed.
  - Lighthouse timeout can be tuned by environment variable without code changes.
