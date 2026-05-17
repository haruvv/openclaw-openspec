## ADDED Requirements

### Requirement: Research Context Persistence
The system SHALL persist stock research context used by AI trading agents.

#### Scenario: Research item is recorded
- **WHEN** an authorized operator records a research item for a symbol
- **THEN** the system stores category, title, summary, source, optional source URL, sentiment, importance, published time, and raw payload

#### Scenario: Market-wide research item is recorded
- **WHEN** an authorized operator records a research item without a specific symbol
- **THEN** the system stores it as market-wide context that can apply to future decisions

### Requirement: Research Context Visibility
The system SHALL show recent research context to authorized stock trading operators.

#### Scenario: Operator opens stock trading dashboard
- **WHEN** recent research items exist
- **THEN** the dashboard displays category, symbol or market-wide scope, title, sentiment, importance, source, and published time

#### Scenario: No research exists
- **WHEN** no research items exist
- **THEN** the dashboard displays an explicit empty research state

### Requirement: Research Context In LLM Decisions
The system SHALL include bounded recent research context in LLM stock decision prompts.

#### Scenario: Symbol research exists
- **WHEN** a market signal for a symbol is processed by the LLM runner
- **THEN** the LLM prompt includes recent research items for that symbol
- **AND** includes recent market-wide research items

#### Scenario: Research does not exist
- **WHEN** a market signal is processed and no research context exists
- **THEN** the LLM prompt explicitly marks fundamentals, news, disclosures, and sector context as unavailable

### Requirement: Research Context Safety
The system MUST treat research context as paper decision input only.

#### Scenario: Research context influences a decision
- **WHEN** research context is included in an LLM decision
- **THEN** the system still applies risk veto, confidence gates, ledger checks, and paper-only execution
- **AND** the system does not call broker order, cancel, transfer, account, or position mutation APIs
