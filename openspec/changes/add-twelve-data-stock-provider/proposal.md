## Why

The paper trading loop can already consume market candles, but it still requires a custom adapter URL or moomoo OpenD gateway. For demo trading, the fastest path is a built-in HTTP provider that can fetch OHLCV candles directly from a standard market data API.

## What Changes

- Add a Twelve Data market data provider mode to the stock market data collector.
- Allow production to run with `STOCK_MARKET_DATA_PROVIDER_KIND=twelvedata` and `TWELVE_DATA_API_KEY` instead of a custom adapter URL.
- Normalize Twelve Data `/time_series` responses into the existing candle shape.
- Keep the generic `STOCK_MARKET_DATA_PROVIDER_URL` adapter path available.

## Capabilities

### New Capabilities
- `twelve-data-stock-provider`: Fetch stock candles from Twelve Data for the existing paper-trading market data collector.

### Modified Capabilities
- None.

## Impact

- Updates stock market data collection provider selection and parsing.
- Adds env forwarding for Cloudflare container runtime.
- Adds collector tests for Twelve Data success and error responses.
