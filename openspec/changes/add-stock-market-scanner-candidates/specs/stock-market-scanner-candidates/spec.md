## ADDED Requirements

### Requirement: Market Scanner Candidate Persistence
The system SHALL persist AI market scanner candidate symbols before full AI investment decisions.

#### Scenario: TradingView signal creates a candidate
- **WHEN** a TradingView stock signal is accepted
- **THEN** the system stores or refreshes a market scanner candidate for the signal symbol
- **AND** the candidate includes source, reason, score, strategy tag, status, and raw source data

#### Scenario: Research item creates a candidate
- **WHEN** an operator records symbol-specific stock research
- **THEN** the system stores or refreshes a market scanner candidate for that symbol
- **AND** the candidate reason references the research title and category

### Requirement: Candidate Management Visibility
The system SHALL show market scanner candidates to authorized stock trading operators.

#### Scenario: Operator opens stock trading dashboard
- **WHEN** market scanner candidates exist
- **THEN** the dashboard displays recent candidates with symbol, source, status, score, and reason

#### Scenario: Operator opens candidate page
- **WHEN** an authorized operator opens the candidate page
- **THEN** the page lists candidates with theme, sector, strategy tag, score, source, status, and latest scan time

### Requirement: Candidate Lifecycle
The system SHALL allow authorized operators to manage market scanner candidate status.

#### Scenario: Candidate is rejected
- **WHEN** an operator rejects a candidate
- **THEN** the candidate status becomes rejected
- **AND** rejected candidates remain visible for auditability

#### Scenario: Candidate is approved for monitoring
- **WHEN** an operator approves a candidate
- **THEN** the candidate status becomes approved

### Requirement: Candidate To Paper Decision
The system SHALL allow a market scanner candidate to be converted into a paper-only AI investment decision.

#### Scenario: Candidate is converted
- **WHEN** an operator converts a candidate to an AI decision
- **THEN** the system processes a paper-only market signal for that candidate
- **AND** the candidate status becomes converted_to_decision with the resulting decision id

### Requirement: Candidate Safety
The system MUST keep market scanner candidates advisory and paper-only.

#### Scenario: Candidate has a high score
- **WHEN** a candidate score is high or approved
- **THEN** the system does not place real broker orders
- **AND** any conversion still applies Risk Manager veto, confidence gates, ledger checks, and paper-only execution
