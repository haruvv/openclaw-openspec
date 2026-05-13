## MODIFIED Requirements

### Requirement: Side-effecting steps are opt-in
The system SHALL NOT send emails, post Telegram messages, or create Stripe Payment Links during smoke validation unless the corresponding smoke flag is explicitly enabled.

#### Scenario: Side-effect flag is disabled
- **WHEN** a side-effecting provider credential is configured but its smoke flag is not enabled
- **THEN** the step is marked `skipped` and no side effect is performed

#### Scenario: Side-effect flag is enabled
- **WHEN** a side-effecting provider credential is configured and its smoke flag is enabled
- **THEN** the smoke harness performs that provider call and records the result
