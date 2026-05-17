## ADDED Requirements

### Requirement: LLM Multi-Agent Decision Runner
The system SHALL generate stock paper-trading decisions with specialist LLM agents when LLM credentials are configured.

#### Scenario: LLM decision is generated
- **WHEN** a valid market signal is processed and LLM mode is available
- **THEN** the system sends signal, indicator, portfolio, and position context to the LLM provider
- **AND** persists specialist agent opinions and the final decision

#### Scenario: External data is unavailable
- **WHEN** fundamentals, news, filings, or live market feeds are not present in the local context
- **THEN** the LLM prompt explicitly states those inputs are unavailable
- **AND** the system requires agents to express uncertainty instead of inventing facts

### Requirement: Risk Manager Veto
The system SHALL enforce Risk Manager rejection before paper execution.

#### Scenario: Risk agent rejects an actionable decision
- **WHEN** the LLM final action is BUY or SELL and the risk agent stance is reject
- **THEN** the persisted final action is WATCH
- **AND** no paper trade is created for the signal

### Requirement: Deterministic Fallback
The system SHALL retain deterministic decision generation as a fallback.

#### Scenario: LLM is not configured
- **WHEN** a market signal is processed without LLM provider credentials
- **THEN** the system uses the deterministic paper decision builder

#### Scenario: LLM response is invalid
- **WHEN** the LLM response cannot be parsed into the required decision schema
- **THEN** the system uses the deterministic paper decision builder
- **AND** processing continues without real broker execution

### Requirement: Paper-Only Agent Runner Safety
The system MUST keep LLM-generated stock decisions paper-only.

#### Scenario: LLM recommends a trade
- **WHEN** the LLM recommends BUY or SELL
- **THEN** the system applies the same confidence gates, ledger checks, and paper-only execution path as deterministic decisions
- **AND** the system does not call broker order, cancel, transfer, account, or position mutation APIs
