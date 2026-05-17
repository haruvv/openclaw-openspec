## ADDED Requirements

### Requirement: Full Agent Meeting Persistence
The system SHALL persist a complete stock agent meeting for each processed real-time market signal decision.

#### Scenario: Deterministic fallback decision is saved
- **WHEN** a TradingView stock signal is processed without LLM agent output
- **THEN** the saved AI decision includes canonical agent opinions for market scanner, fundamental, news, technical, entry, exit, risk, portfolio, review-learning, knowledge-curator, and judge

#### Scenario: LLM decision omits some agents
- **WHEN** an LLM decision returns only a partial agent list
- **THEN** the system preserves the provided opinions
- **AND** fills missing canonical agent opinions before saving the decision

### Requirement: Agent Meeting Visibility
The system SHALL show full agent meeting details to authorized stock trading operators.

#### Scenario: Operator opens decision detail
- **WHEN** a decision has canonical agent opinions
- **THEN** the page displays the AI investment meeting and the number of saved agent opinions
- **AND** each agent opinion displays name, score, stance, summary, and reasoning

### Requirement: Agent Meeting Safety
The system MUST keep agent meetings paper-only.

#### Scenario: Agent meeting recommends action
- **WHEN** the judge or any other agent recommends BUY or SELL
- **THEN** Risk Manager veto, confidence gates, ledger checks, and paper-only execution still apply
- **AND** the system does not call real broker order, cancel, transfer, account, or position mutation APIs
