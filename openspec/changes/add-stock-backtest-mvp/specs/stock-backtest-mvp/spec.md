## ADDED Requirements

### Requirement: Historical Candle Persistence
The system SHALL persist normalized stock OHLCV candles for backtesting.

#### Scenario: Candle batch is imported
- **WHEN** an authorized operator imports candles for a symbol and timeframe
- **THEN** the system stores open, high, low, close, volume, source, and timestamp for each candle
- **AND** repeated imports for the same symbol, timeframe, and timestamp update the existing candle instead of duplicating it

#### Scenario: Candles are listed
- **WHEN** stored candles are requested for a symbol and timeframe
- **THEN** the system returns them in chronological order within the requested limit

### Requirement: Backtest Execution
The system SHALL run deterministic backtests against stored candles.

#### Scenario: Enough candles exist
- **WHEN** an authorized operator runs a supported strategy backtest with enough candles
- **THEN** the system simulates entries and exits using only candles available at each step
- **AND** the system applies configured fee bps and slippage bps
- **AND** the system persists a backtest run summary and simulated trades

#### Scenario: Not enough candles exist
- **WHEN** a backtest is requested without enough candles for the chosen rule
- **THEN** the system rejects the run with a clear validation error

### Requirement: Backtest Metrics
The system SHALL report useful strategy validation metrics for backtest runs.

#### Scenario: Backtest completes
- **WHEN** a backtest run completes
- **THEN** the system reports trade count, win rate, realized PnL, average profit, average loss, expectancy, Profit Factor, maximum drawdown, and date range

#### Scenario: Backtest has no trades
- **WHEN** a backtest completes without simulated trades
- **THEN** the system reports zero trade count and null ratio metrics instead of failing

### Requirement: Backtest Visibility
The system SHALL show backtest runs to authorized stock trading operators.

#### Scenario: Operator opens backtest page
- **WHEN** backtest runs exist
- **THEN** the page displays each run with symbol, timeframe, strategy, trade count, win rate, PnL, Profit Factor, maximum drawdown, and status

#### Scenario: No backtest runs exist
- **WHEN** no backtest runs exist
- **THEN** the page displays an explicit empty state

### Requirement: Backtest Safety
The system MUST keep backtests isolated from live and paper execution state.

#### Scenario: Backtest runs
- **WHEN** a backtest is executed
- **THEN** the system writes only candle, backtest run, and simulated backtest trade records
- **AND** the system does not create stock paper trades, mutate positions, create portfolio snapshots, or call broker APIs
