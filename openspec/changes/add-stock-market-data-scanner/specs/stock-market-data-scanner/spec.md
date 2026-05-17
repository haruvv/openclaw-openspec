## ADDED Requirements

### Requirement: Candle-Based Candidate Detection
The system SHALL detect stock candidates from collected candle history.

#### Scenario: Breakout and volume expansion are present
- **WHEN** the scanner runs for an enabled watchlist entry with enough stored candles
- **AND** the latest close is above the previous lookback high
- **AND** latest volume is above the recent average volume
- **THEN** the system creates or updates a provider-sourced stock market candidate
- **AND** the candidate includes the latest price, timeframe, volume context, score, and reason

#### Scenario: Candle history is insufficient
- **WHEN** the scanner runs for a watchlist entry without enough candles
- **THEN** the entry is skipped
- **AND** no candidate is created for that entry

### Requirement: Scanner Admin Trigger
The system SHALL allow authorized stock trading operators to run candle scanning on demand.

#### Scenario: Operator triggers scan
- **WHEN** an operator triggers scanner execution from the admin UI
- **THEN** the system scans enabled watchlist entries
- **AND** the UI shows created and skipped counts

### Requirement: Scanner Safety
The system MUST keep scanner output advisory and paper-only.

#### Scenario: Scanner finds a candidate
- **WHEN** a provider candidate is created
- **THEN** the system does not place a broker order
- **AND** existing candidate review, AI decision, risk gates, and paper execution controls still apply
