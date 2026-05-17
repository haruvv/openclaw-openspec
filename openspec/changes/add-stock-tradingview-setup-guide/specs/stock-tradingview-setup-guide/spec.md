## ADDED Requirements

### Requirement: TradingView Setup Guide
The system SHALL show TradingView webhook setup guidance to authorized stock trading operators.

#### Scenario: Operator opens settings
- **WHEN** an authorized operator opens the stock trading settings page
- **THEN** the system displays the TradingView webhook URL
- **AND** the system displays the required secret header name without exposing the secret value

#### Scenario: Webhook secret is missing
- **WHEN** `TRADINGVIEW_WEBHOOK_SECRET` is not configured
- **THEN** the settings page shows the webhook as not ready
- **AND** still displays the endpoint and payload template

### Requirement: TradingView Alert Payload Template
The system SHALL provide a TradingView alert JSON template compatible with the webhook parser.

#### Scenario: Operator views alert template
- **WHEN** an authorized operator opens the stock trading settings page
- **THEN** the system displays a JSON template including symbol, timeframe, price, action, strategy, and indicators

### Requirement: Latest Signal Verification
The system SHALL show latest TradingView signal metadata on the settings page.

#### Scenario: Signals have been received
- **WHEN** at least one TradingView market signal exists
- **THEN** the settings page displays the latest signal symbol, status, received time, timeframe, and price

#### Scenario: No signals have been received
- **WHEN** no TradingView market signals exist
- **THEN** the settings page displays an explicit empty verification state
