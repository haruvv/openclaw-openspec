## ADDED Requirements

### Requirement: Watchlist Configuration
The system SHALL allow authorized stock trading operators to configure symbols and timeframes for market data collection.

#### Scenario: Operator creates a watchlist entry
- **WHEN** an operator creates a watchlist entry with symbol, timeframe, provider, and lookback limit
- **THEN** the system persists the entry as enabled by default
- **AND** the entry is visible in the stock market data admin page

#### Scenario: Disabled entry is preserved
- **WHEN** an operator disables a watchlist entry
- **THEN** the entry remains visible for auditability
- **AND** collector runs do not fetch candles for that entry

### Requirement: Provider Candle Collection
The system SHALL fetch OHLCV candles for enabled watchlist entries from a configured market data provider endpoint.

#### Scenario: Provider returns candles
- **WHEN** the collector runs and the provider returns valid candles for an enabled entry
- **THEN** the system stores the candles in `stock_candles`
- **AND** repeated collection for the same symbol, timeframe, and timestamp does not duplicate rows

#### Scenario: Provider is not configured
- **WHEN** the collector runs without a configured provider endpoint
- **THEN** the run is recorded as failed
- **AND** existing candles remain unchanged

#### Scenario: Provider returns invalid data
- **WHEN** the provider response lacks valid timestamp, open, high, low, close, or volume values
- **THEN** the run is recorded as failed with an error message
- **AND** invalid candles are not stored

### Requirement: Collection Run Audit
The system SHALL record market data collection runs for operator review.

#### Scenario: Collection completes
- **WHEN** the collector finishes processing enabled entries
- **THEN** the system records run status, requested entry count, completed entry count, upserted candle count, started time, and completed time

#### Scenario: Operator opens collection status
- **WHEN** an operator opens the stock market data admin page
- **THEN** recent collection runs are listed with provider, status, counts, error, and timestamps

### Requirement: Admin Trigger
The system SHALL allow authorized stock trading operators to trigger market data collection on demand.

#### Scenario: Operator triggers collection
- **WHEN** an operator triggers collection from the admin UI
- **THEN** the system runs collection for enabled watchlist entries
- **AND** the UI refreshes to show the latest run and candle counts

### Requirement: Paper-Only Market Data
The system MUST keep market data collection separate from broker execution.

#### Scenario: Collection runs
- **WHEN** the collector fetches candles
- **THEN** it only calls read-only market data provider endpoints
- **AND** it does not call real broker order, cancel, transfer, account, or position mutation APIs
