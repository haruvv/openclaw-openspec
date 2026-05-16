## MODIFIED Requirements

### Requirement: Step-level pass/fail/skip reporting
The system SHALL record each smoke step and production run step as `passed`, `failed`, or `skipped`, including duration and diagnostic details sufficient to identify the failing provider, missing dependency, or runtime stage.

#### Scenario: Required credential is missing
- **WHEN** a provider step requires a credential that is not configured
- **THEN** that step is marked `skipped` with the missing credential reason
- **AND** the step details include a structured diagnostic object naming the dependency without exposing the credential value

#### Scenario: Provider call fails
- **WHEN** a provider call throws an error
- **THEN** that step is marked `failed` with a sanitized error message
- **AND** the step details include a structured diagnostic object identifying provider/stage, sanitized message, and retry classification where available

#### Scenario: Degraded provider fallback is used
- **WHEN** a provider failure is non-fatal and the run continues with fallback data
- **THEN** the step remains `passed` or `skipped` according to its behavior
- **AND** the report includes a warning diagnostic describing the fallback provider failure
