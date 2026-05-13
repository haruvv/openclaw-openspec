## Purpose

外部サービス境界を含むSEOアウトリーチパイプラインの実行環境を、1件のターゲットURLで安全に検証するためのE2E smoke harnessを提供する。

## Requirements

### Requirement: E2E smoke harness command
The system SHALL provide an operator command that runs a one-target E2E smoke validation and produces a structured result.

#### Scenario: Smoke command runs with target URL
- **WHEN** the operator runs the smoke command with a target URL
- **THEN** the system validates the configured pipeline steps for that URL and returns a summary result

#### Scenario: Smoke command uses default target URL
- **WHEN** the operator runs the smoke command without a target URL
- **THEN** the system uses the configured default smoke target URL

### Requirement: Step-level pass/fail/skip reporting
The system SHALL record each smoke step as `passed`, `failed`, or `skipped`, including duration and diagnostic details.

#### Scenario: Required credential is missing
- **WHEN** a provider step requires a credential that is not configured
- **THEN** that step is marked `skipped` with the missing credential reason

#### Scenario: Provider call fails
- **WHEN** a provider call throws an error
- **THEN** that step is marked `failed` with a sanitized error message

### Requirement: Side-effecting steps are opt-in
The system SHALL NOT send emails, post Telegram messages, or create Stripe Payment Links during smoke validation unless the corresponding smoke flag is explicitly enabled.

#### Scenario: Side-effect flag is disabled
- **WHEN** a side-effecting provider credential is configured but its smoke flag is not enabled
- **THEN** the step is marked `skipped` and no side effect is performed

#### Scenario: Side-effect flag is enabled
- **WHEN** a side-effecting provider credential is configured and its smoke flag is enabled
- **THEN** the smoke harness performs that provider call and records the result

### Requirement: Smoke report persistence
The system SHALL save each smoke run report as JSON under `output/smoke-runs/`.

#### Scenario: Smoke run completes
- **WHEN** the smoke run reaches the summary phase
- **THEN** the system writes a timestamped JSON report containing step results and run metadata
