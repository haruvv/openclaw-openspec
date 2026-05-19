## ADDED Requirements

### Requirement: Autonomous Paper Cycle
The system SHALL run stock market data collection, candle scanning, and eligible candidate conversion as one paper-trading workflow.

#### Scenario: Cycle finds eligible provider candidate
- **WHEN** the autonomous stock paper cycle runs
- **AND** collection and scanning create a provider candidate above the auto-conversion threshold
- **THEN** the system converts the candidate into an AI investment meeting decision
- **AND** any resulting execution uses the existing internal paper ledger only

#### Scenario: No eligible candidates exist
- **WHEN** the autonomous stock paper cycle runs without provider candidates above threshold
- **THEN** the system records zero conversions
- **AND** the cycle returns skipped counts without error

### Requirement: Internal Scheduled Job
The system SHALL expose an authenticated internal endpoint for stock paper cycles.

#### Scenario: Authorized internal request
- **WHEN** `/internal/jobs/stock-trading-cycle` receives a valid integration token
- **THEN** the system runs the autonomous paper cycle
- **AND** returns a cycle summary

#### Scenario: Unauthorized internal request
- **WHEN** the internal endpoint receives no valid integration token
- **THEN** the system rejects the request
- **AND** no market data collection, candidate scan, or paper decision runs

### Requirement: Admin Cycle Trigger
The system SHALL allow authorized stock trading operators to trigger the autonomous paper cycle manually.

#### Scenario: Operator runs cycle
- **WHEN** an operator starts the cycle from the stock market data UI
- **THEN** the UI shows collection, scan, conversion, skipped, and error counts

### Requirement: Paper-Only Automation Safety
The system MUST keep autonomous stock automation paper-only.

#### Scenario: Automation converts a candidate
- **WHEN** an autonomous cycle produces a BUY or SELL decision
- **THEN** broker order, cancel, transfer, account, and real position mutation APIs are not called
- **AND** confidence gates, Risk Manager veto, and internal ledger checks still apply
