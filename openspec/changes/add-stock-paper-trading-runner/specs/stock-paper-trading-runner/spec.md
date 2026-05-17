## ADDED Requirements

### Requirement: TradingView Webhook Signal Ingestion
The system SHALL accept authenticated TradingView-style webhook signals for stock paper trading.

#### Scenario: Authenticated webhook is accepted
- **WHEN** a request posts a valid stock signal with the configured TradingView webhook secret
- **THEN** the system stores the signal with source, symbol, timeframe, price, indicator payload, raw payload, and received timestamp
- **AND** the response includes the signal ID and processing status

#### Scenario: Missing or invalid webhook secret is rejected
- **WHEN** a request posts a stock signal without the configured TradingView webhook secret
- **THEN** the system rejects the request with an unauthorized response
- **AND** no signal, decision, paper trade, or portfolio snapshot is created

#### Scenario: Malformed signal is rejected
- **WHEN** a request posts a signal with missing symbol, invalid price, or unsupported payload shape
- **THEN** the system rejects the request with a validation error
- **AND** no paper trade is created

### Requirement: Market Signal Persistence
The system SHALL persist normalized market signals independently from AI decisions and paper trades.

#### Scenario: Operator views recent signals
- **WHEN** an authorized operator opens the stock trading dashboard or signal view
- **THEN** the system displays recent signals with symbol, timeframe, source, price, strategy tag, status, and received time

#### Scenario: Signal raw payload is retained without secrets
- **WHEN** the system stores a webhook signal
- **THEN** the system retains the raw market payload for debugging
- **AND** the system does not expose webhook secrets in admin API responses

### Requirement: Paper AI Decision Runner
The system SHALL generate structured paper-only AI decisions from accepted market signals.

#### Scenario: Signal creates AI decision
- **WHEN** a valid market signal is processed by the paper runner
- **THEN** the system creates a stock AI decision with symbol, final action, confidence, strategy tag, reasoning, risk factors, take-profit, stop-loss, and agent opinions
- **AND** the decision is linked to the originating signal

#### Scenario: Watch decision creates no execution
- **WHEN** the paper runner returns `WATCH`
- **THEN** the system records the AI decision
- **AND** the system does not create a paper trade

### Requirement: Paper-Only Simulated Execution
The system SHALL create simulated paper trades only for actionable decisions that pass safety checks.

#### Scenario: Buy decision creates paper trade
- **WHEN** the paper runner returns a `BUY` decision above the configured confidence threshold
- **THEN** the system creates an internal stock trade with execution source `paper`
- **AND** the trade uses the signal price, configured paper notional sizing, and the linked decision ID

#### Scenario: Low confidence decision is blocked
- **WHEN** the paper runner returns an actionable decision below the configured confidence threshold
- **THEN** the system records the AI decision and risk factor
- **AND** the system does not create a paper trade

#### Scenario: Broker mutation APIs are never called
- **WHEN** webhook processing creates or blocks a paper decision
- **THEN** the system MUST NOT call broker order, cancel, transfer, or account mutation APIs

### Requirement: Paper Portfolio Snapshot Updates
The system SHALL update paper portfolio snapshots after simulated executions.

#### Scenario: Paper trade updates portfolio snapshot
- **WHEN** the system creates a paper trade from a signal
- **THEN** the system stores a new paper portfolio snapshot with updated equity, cash, realized P&L, unrealized P&L, and capture time

#### Scenario: Non-executed decision leaves portfolio unchanged
- **WHEN** the system processes a signal without creating a paper trade
- **THEN** the system does not create a new portfolio snapshot solely for that signal

### Requirement: Admin Runner Visibility
The system SHALL expose paper runner status and recent signal outcomes to authorized admin users.

#### Scenario: Operator opens stock trading dashboard
- **WHEN** an authorized operator opens `/admin/stock-trading`
- **THEN** the dashboard includes paper-only runner status and recent market signals
- **AND** existing decisions, trades, lessons, and integration status remain visible

#### Scenario: Operator opens settings
- **WHEN** an authorized operator opens stock trading settings
- **THEN** the system shows whether TradingView webhook configuration is present without exposing secret values
