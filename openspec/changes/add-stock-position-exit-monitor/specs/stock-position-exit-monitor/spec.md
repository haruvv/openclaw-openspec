## ADDED Requirements

### Requirement: Open Position Exit Review
The system SHALL allow authorized stock trading operators to trigger AI exit reviews for open internal paper positions.

#### Scenario: Operator reviews an open position
- **WHEN** an operator requests an exit review for an open paper position
- **THEN** the system creates a paper-only AI decision using current position facts
- **AND** the decision is visible in existing AI decision history

#### Scenario: Position does not exist
- **WHEN** an operator requests an exit review for a symbol without an open paper position
- **THEN** the system rejects the request without creating an AI decision

### Requirement: Exit Review Context
The system SHALL include open position facts in exit review decisions.

#### Scenario: Exit review signal is created
- **WHEN** the system creates an exit review signal
- **THEN** the signal context includes average entry price, mark price, quantity, market value, realized PnL, unrealized PnL, unrealized PnL rate, and holding period

### Requirement: Exit Review Visibility
The system SHALL expose exit review actions in the stock trading admin UI.

#### Scenario: Operator views open positions
- **WHEN** an open position is displayed
- **THEN** the UI provides an Exit review action for that position
- **AND** the action refreshes the dashboard after completion

### Requirement: Exit Review Safety
The system MUST keep exit reviews paper-only.

#### Scenario: Exit review recommends SELL
- **WHEN** an Exit Agent or Judge recommends SELL
- **THEN** Risk Manager veto, confidence gates, ledger checks, and paper-only execution still apply
- **AND** the system does not call real broker order, cancel, transfer, account, or position mutation APIs
