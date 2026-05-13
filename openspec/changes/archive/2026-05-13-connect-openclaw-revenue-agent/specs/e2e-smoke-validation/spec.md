## MODIFIED Requirements

### Requirement: E2E smoke harness command
The system SHALL provide an operator command that runs a one-target E2E smoke validation and produces a structured result. The smoke harness SHALL reuse the same neutral run logic used by OpenClaw-facing execution while preserving smoke-specific defaults and report persistence.

#### Scenario: Smoke command runs with target URL
- **WHEN** the operator runs the smoke command with a target URL
- **THEN** the system validates the configured pipeline steps for that URL and returns a summary result

#### Scenario: Smoke command uses default target URL
- **WHEN** the operator runs the smoke command without a target URL
- **THEN** the system uses the configured default smoke target URL

#### Scenario: Smoke command and OpenClaw run share step behavior
- **WHEN** the smoke command and OpenClaw-facing run capability execute with equivalent inputs and side-effect flags
- **THEN** both paths SHALL use consistent crawl, proposal, email, Telegram, and Stripe step behavior
