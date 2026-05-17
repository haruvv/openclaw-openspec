## ADDED Requirements

### Requirement: Stock Trading App Entry
The system SHALL provide an authenticated stock trading business app under `/admin/stock-trading`.

#### Scenario: Authorized operator opens stock trading app
- **WHEN** an authorized operator opens `/admin/stock-trading`
- **THEN** the system displays the stock trading dashboard
- **AND** the business app portal links to the stock trading app as an active app

#### Scenario: Unauthorized operator opens stock trading app
- **WHEN** a production request opens `/admin/stock-trading` without a valid admin token
- **THEN** the system denies access or prompts for the admin token

### Requirement: Portfolio Dashboard
The system SHALL show paper portfolio status for the stock trading MVP.

#### Scenario: Operator opens dashboard
- **WHEN** an operator opens the stock trading dashboard
- **THEN** the system displays initial capital, current equity, cash balance, realized P&L, unrealized P&L, win rate, and maximum drawdown

#### Scenario: No portfolio data exists
- **WHEN** an operator opens the stock trading dashboard before any portfolio snapshots exist
- **THEN** the system displays an empty paper portfolio state without implying real broker account access

### Requirement: Persist AI Trading Decisions
The system SHALL persist AI trading decisions with final action, confidence, strategy context, reasoning, risk factors, and timestamps.

#### Scenario: AI decision is recorded
- **WHEN** a stock trading decision is saved
- **THEN** the system stores the symbol, final action, confidence, strategy tag, reasoning, risk factors, take-profit price, stop-loss price, and creation time

#### Scenario: Operator views decision list
- **WHEN** an operator opens the AI decisions view
- **THEN** the system displays recent decisions with symbol, final action, confidence, strategy tag, risk summary, and creation time

### Requirement: Persist Per-Agent Opinions
The system SHALL persist specialist agent opinions linked to each AI trading decision.

#### Scenario: Decision includes specialist opinions
- **WHEN** a decision contains market, fundamental, news, technical, entry, exit, risk, portfolio, or judge agent output
- **THEN** the system stores each agent name, score, stance, summary, reasoning, and creation time linked to the parent decision

#### Scenario: Operator opens decision detail
- **WHEN** an operator opens a decision detail view
- **THEN** the system displays the final decision beside each specialist agent opinion
- **AND** the risk manager opinion is visually distinguishable when it rejects a trade

### Requirement: Persist Internal Paper Trades
The system SHALL persist internal paper trades without placing real broker orders.

#### Scenario: Paper trade is recorded
- **WHEN** an operator records or approves a paper execution
- **THEN** the system stores the linked decision when present, symbol, side, quantity, price, execution time, execution source, and raw execution metadata

#### Scenario: Operator views trades
- **WHEN** an operator opens the trades view
- **THEN** the system displays paper trade history with symbol, side, quantity, price, execution source, linked AI reasoning, and realized outcome when available

### Requirement: Maintain Portfolio Snapshots
The system SHALL persist paper portfolio snapshots derived from internal paper-trading state.

#### Scenario: Portfolio snapshot is captured
- **WHEN** portfolio state is recalculated or explicitly captured
- **THEN** the system stores total equity, cash balance, unrealized P&L, realized P&L, and capture time

#### Scenario: Dashboard displays latest portfolio
- **WHEN** an operator opens the stock trading dashboard after snapshots exist
- **THEN** the system displays the latest snapshot values and an ordered history suitable for an equity curve

### Requirement: Persist Learning Items
The system SHALL persist post-trade learning items and rule candidates.

#### Scenario: Learning item is recorded
- **WHEN** a trade review creates a lesson
- **THEN** the system stores the source trade when present, category, title, body, confidence, applied-to-skill state, and creation time

#### Scenario: Operator opens lessons view
- **WHEN** an operator opens the lessons view
- **THEN** the system displays winning patterns, losing patterns, new rule candidates, blocked patterns, and skill application state

### Requirement: Paper-Only Safety Boundary
The system MUST prevent the stock trading MVP from placing real-money orders or mutating broker account state.

#### Scenario: Broker credentials are configured
- **WHEN** broker or market-data credentials are present in the environment
- **THEN** the stock trading MVP still records only internal paper decisions, paper executions, and integration status
- **AND** it does not submit real orders, cancel real orders, transfer funds, or change broker account configuration

#### Scenario: Operator records an execution
- **WHEN** an operator records a trade from the stock trading UI
- **THEN** the system labels the execution as paper, demo, or manual
- **AND** the system does not represent the execution as a confirmed real-money broker fill

### Requirement: Market Data Integration Status
The system SHALL show market-data and broker integration readiness without requiring live provider connectivity for the MVP.

#### Scenario: Operator opens stock trading settings
- **WHEN** an operator opens the stock trading settings or integration status view
- **THEN** the system displays configured or missing status for planned market-data and broker providers without showing secret values

#### Scenario: Provider is not configured
- **WHEN** moomoo, TradingView, or another planned provider is not configured
- **THEN** the system keeps stock trading dashboard, decisions, trades, and lessons usable with internal paper data
