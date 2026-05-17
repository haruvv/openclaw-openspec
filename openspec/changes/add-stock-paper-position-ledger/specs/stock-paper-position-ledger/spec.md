## ADDED Requirements

### Requirement: Paper Position Ledger
The system SHALL maintain a paper-only position ledger for stock trading symbols.

#### Scenario: Buy opens a position
- **WHEN** a paper BUY execution is created for a symbol with no existing position
- **THEN** the system stores an open position with the bought quantity, average entry price, last mark price, zero realized PnL, and timestamps

#### Scenario: Buy adds to an existing position
- **WHEN** a paper BUY execution is created for a symbol with an existing long position
- **THEN** the system increases the position quantity
- **AND** recalculates the weighted average entry price

#### Scenario: Sell reduces an existing position
- **WHEN** a paper SELL execution is created for a symbol with sufficient paper quantity
- **THEN** the system reduces the position quantity
- **AND** records realized PnL using average-cost accounting

#### Scenario: Sell cannot exceed paper position
- **WHEN** a paper SELL decision requests more quantity than the current paper position
- **THEN** the system blocks the execution
- **AND** no paper trade or portfolio snapshot is created for that signal

### Requirement: Ledger-Derived Portfolio Metrics
The system SHALL derive paper portfolio metrics from cash, open positions, realized PnL, and latest marks.

#### Scenario: Portfolio includes open position value
- **WHEN** an operator opens the stock trading dashboard after paper executions
- **THEN** current equity includes cash plus marked value of open positions
- **AND** unrealized PnL reflects the difference between current mark and average entry price

#### Scenario: Snapshot captures ledger state
- **WHEN** the paper runner creates an execution
- **THEN** the system stores a portfolio snapshot derived from the updated ledger state

### Requirement: Admin Position Visibility
The system SHALL expose open paper positions to authorized admin users.

#### Scenario: Operator views dashboard positions
- **WHEN** an authorized operator opens the stock trading dashboard
- **THEN** the dashboard displays open positions with symbol, quantity, average entry price, market value, unrealized PnL, realized PnL, and last mark time

#### Scenario: Empty positions are explicit
- **WHEN** there are no open paper positions
- **THEN** the dashboard displays an empty paper positions state without implying broker account access

### Requirement: Paper-Only Ledger Safety
The system MUST keep position ledger updates internal to paper trading.

#### Scenario: Ledger update is applied
- **WHEN** the system applies a paper fill to the position ledger
- **THEN** the system does not call broker order, cancel, transfer, account, or position mutation APIs
