## ADDED Requirements

### Requirement: Run steps persist structured failure diagnostics
The system SHALL persist structured, secret-safe diagnostic details for each run step that fails or is skipped for an operational reason.

#### Scenario: Step throws an exception
- **WHEN** a revenue-agent step throws an exception during execution
- **THEN** the persisted step record includes `status=failed`, a sanitized `error` string, and a structured diagnostic object with error name, sanitized message, duration, and retry classification where available

#### Scenario: Step is skipped due to missing configuration
- **WHEN** a revenue-agent step is skipped because a required environment variable or credential is absent
- **THEN** the persisted step record includes `status=skipped`, the missing configuration reason, and a structured diagnostic object identifying the skipped dependency without exposing secret values

### Requirement: Provider and runtime failures are logged with run context
The system SHALL write structured application logs for provider and runtime failures using run ID and step name context.

#### Scenario: Provider call fails
- **WHEN** an LLM, SendGrid, Telegram, Stripe, Firecrawl, Lighthouse, or storage provider call fails
- **THEN** the application log includes the provider or step name, run ID when available, sanitized error message, and failure reason category

#### Scenario: Failure contains sensitive data
- **WHEN** an exception message or provider response may include tokens, credentials, URLs with sensitive query strings, or authorization headers
- **THEN** persisted diagnostics and logs do not include raw secret values

### Requirement: Degraded fallback execution is visible in run details
The system SHALL record when a run continues with degraded fallback behavior instead of silently hiding the degraded provider.

#### Scenario: Lighthouse fallback is used
- **WHEN** Lighthouse measurement fails but crawling succeeds and the system continues with crawl-only analysis
- **THEN** the run output and crawl step details include a warning indicating Lighthouse fallback, the failure category, and a sanitized message

#### Scenario: Degraded run completes
- **WHEN** a run completes successfully after a degraded fallback
- **THEN** the run remains `passed` if required downstream steps completed, but the run details still show the fallback warning
