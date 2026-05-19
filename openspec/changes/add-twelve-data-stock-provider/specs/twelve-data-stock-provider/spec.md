## ADDED Requirements

### Requirement: Twelve Data Candle Provider
The system SHALL support Twelve Data as a built-in stock candle provider for paper trading market data collection.

#### Scenario: Collector uses Twelve Data provider
- **WHEN** `STOCK_MARKET_DATA_PROVIDER_KIND` is `twelvedata`
- **AND** `TWELVE_DATA_API_KEY` is configured
- **THEN** the collector fetches candles from Twelve Data `/time_series`
- **AND** stores them using the existing stock candle repository

#### Scenario: Twelve Data response contains candles
- **WHEN** Twelve Data returns time series values
- **THEN** the provider maps datetime/open/high/low/close/volume into the existing candle format
- **AND** preserves the watchlist symbol, timeframe, and provider as candle metadata

#### Scenario: Twelve Data configuration is missing
- **WHEN** Twelve Data mode is selected without `TWELVE_DATA_API_KEY`
- **THEN** the collection run is recorded as failed
- **AND** no paper decision or real broker action is created by the collector itself

#### Scenario: Existing custom adapter remains supported
- **WHEN** Twelve Data mode is not selected
- **THEN** the collector continues to use `STOCK_MARKET_DATA_PROVIDER_URL` if configured
