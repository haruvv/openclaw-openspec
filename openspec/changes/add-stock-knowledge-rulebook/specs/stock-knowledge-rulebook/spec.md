## ADDED Requirements

### Requirement: Rule Candidate Extraction
The system SHALL create reusable stock trading rule candidates from paper-trade learning items.

#### Scenario: Learning item is saved
- **WHEN** a stock learning item is created from a paper trade review
- **THEN** the system creates a stock trading rule candidate linked to that learning item
- **AND** repeated processing of the same learning item does not create duplicate rules

### Requirement: Rulebook Management
The system SHALL allow authorized stock trading operators to manage rule status.

#### Scenario: Operator activates a rule
- **WHEN** an operator marks a candidate rule as active
- **THEN** the rule status becomes active
- **AND** the rule can be included in future AI decision payloads

#### Scenario: Operator rejects a rule
- **WHEN** an operator rejects a rule
- **THEN** the rule status becomes rejected
- **AND** the rule remains visible for auditability

### Requirement: Rulebook Decision Context
The system SHALL include active stock trading rules in LLM-backed paper trading decisions.

#### Scenario: Active rules exist
- **WHEN** a TradingView signal, candidate conversion, or exit review creates an LLM decision
- **THEN** the LLM payload includes active rulebook entries with category, title, rule text, confidence, and source learning item id

### Requirement: Rulebook Visibility
The system SHALL show stock trading rules to authorized operators.

#### Scenario: Operator opens the stock dashboard
- **WHEN** stock trading rules exist
- **THEN** recent rules are visible from the dashboard

#### Scenario: Operator opens the rulebook page
- **WHEN** an authorized operator opens the rulebook page
- **THEN** rules are listed with category, title, status, confidence, source lesson, and rule text

### Requirement: Rulebook Safety
The system MUST keep rulebook guidance paper-only.

#### Scenario: Active rule suggests a buy or sell constraint
- **WHEN** an active rule is included in an AI decision
- **THEN** Risk Manager veto, confidence gates, ledger checks, and paper-only execution still apply
- **AND** the system does not call real broker order, cancel, transfer, account, or position mutation APIs
