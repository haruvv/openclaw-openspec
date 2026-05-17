## ADDED Requirements

### Requirement: Completed Paper Trade Review
The system SHALL review completed stock paper trades that realize PnL.

#### Scenario: Winning SELL trade is reviewed
- **WHEN** an internal paper SELL trade is recorded with positive realized PnL
- **THEN** the system records at least one learning item linked to the trade
- **AND** the learning item identifies the outcome as a winning pattern or strategy note

#### Scenario: Losing SELL trade is reviewed
- **WHEN** an internal paper SELL trade is recorded with negative realized PnL
- **THEN** the system records at least one learning item linked to the trade
- **AND** the learning item identifies the outcome as a losing pattern, rule candidate, or blocked pattern

#### Scenario: Opening BUY trade is not reviewed
- **WHEN** an internal paper BUY trade is recorded
- **THEN** the system does not create completed-trade learning items for that trade

### Requirement: Review Context
The system SHALL include available decision context when creating trade learning items.

#### Scenario: Linked AI decision exists
- **WHEN** a completed paper trade has a linked AI decision
- **THEN** the generated learning item includes the decision action, confidence, strategy tag, reasoning, and risk factors when available

#### Scenario: Agent opinions exist
- **WHEN** the linked AI decision has agent opinions
- **THEN** the generated learning item includes a concise summary of relevant agent stances

#### Scenario: Research context exists
- **WHEN** recent symbol-specific or market-wide research context exists for the traded symbol
- **THEN** the generated learning item includes a concise reference to the relevant research context

### Requirement: Review Idempotency
The system MUST avoid duplicate learning items for the same reviewed trade.

#### Scenario: Trade review is retried
- **WHEN** the same completed paper trade is reviewed more than once
- **THEN** the system keeps a single set of learning items for that trade

### Requirement: Review Safety
The system MUST treat trade review as paper learning only.

#### Scenario: Trade review runs
- **WHEN** a completed paper trade is reviewed
- **THEN** the system writes learning records only
- **AND** the system does not call broker order, cancel, transfer, account, or position mutation APIs
