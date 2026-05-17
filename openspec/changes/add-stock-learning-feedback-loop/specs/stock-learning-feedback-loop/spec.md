## ADDED Requirements

### Requirement: Learning Context In AI Decisions
The system SHALL include bounded prior stock learning items as context for LLM-backed paper trading decisions.

#### Scenario: Prior learning items exist
- **WHEN** a TradingView stock signal is processed and prior learning items exist
- **THEN** the LLM decision payload includes recent learning items with category, title, body, confidence, source trade id, skill application state, and creation time
- **AND** the payload describes the learning items as historical paper-trade observations

#### Scenario: No prior learning items exist
- **WHEN** a TradingView stock signal is processed and no learning items exist
- **THEN** the LLM decision payload includes an empty learning context
- **AND** the decision still proceeds through the existing paper-only decision flow

### Requirement: Decision Learning Provenance
The system SHALL persist which learning items were attached to each stock AI decision.

#### Scenario: Decision is saved with selected lessons
- **WHEN** a stock AI decision is created after selecting prior learning items
- **THEN** the system stores references from the decision to each selected learning item
- **AND** repeated saves for the same decision and lesson do not create duplicate references

#### Scenario: Existing decision has no selected lessons
- **WHEN** an operator opens a decision created before learning feedback refs existed
- **THEN** the system returns the decision with an empty selected lesson list

### Requirement: Learning Context Visibility
The system SHALL show attached learning context to authorized stock trading operators.

#### Scenario: Operator opens decision detail
- **WHEN** a decision has attached learning item references
- **THEN** the decision detail page displays the lessons used by that decision
- **AND** each displayed lesson shows category, title, confidence, skill application state, and body

### Requirement: Learning Feedback Safety
The system MUST keep learning feedback paper-only.

#### Scenario: Lessons influence an action recommendation
- **WHEN** prior lessons are included in an LLM decision payload
- **THEN** Risk Manager veto, confidence gates, ledger checks, and paper-only execution still apply
- **AND** the system does not call real broker order, cancel, transfer, account, or position mutation APIs
