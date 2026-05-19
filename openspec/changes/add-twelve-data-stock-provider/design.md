## Context

The current collector accepts either an injected provider for tests or a generic HTTP adapter configured by `STOCK_MARKET_DATA_PROVIDER_URL`. That works, but it pushes users to run an extra adapter service. Twelve Data exposes a direct HTTPS `/time_series` endpoint with `symbol`, `interval`, `outputsize`, and `apikey` parameters, which is enough for demo chart-driven paper trading.

## Goals / Non-Goals

**Goals:**

- Add a no-adapter Twelve Data provider mode.
- Preserve the existing custom HTTP provider behavior.
- Map local watchlist timeframes to Twelve Data intervals.
- Normalize successful and error responses into current collector behavior.

**Non-Goals:**

- Real-money broker integration.
- WebSocket streaming.
- Provider account signup or key management UI.
- Multi-provider comparison logic.

## Decisions

1. Provider selection is env-driven.

   `STOCK_MARKET_DATA_PROVIDER_KIND=twelvedata` selects the built-in provider. Missing or unknown kind keeps the current adapter provider for backward compatibility.

2. Twelve Data API key is separate.

   Use `TWELVE_DATA_API_KEY` rather than overloading `STOCK_MARKET_DATA_PROVIDER_TOKEN`, because the latter protects custom adapters and is sent as a bearer token.

3. The collector remains candle-oriented.

   The provider returns `CreateStockCandleInput[]`, and the existing scanner/autonomous cycle remain unchanged.

4. Errors are explicit.

   Missing API key returns `twelve_data_api_key_not_configured`. Twelve Data error payloads return `twelve_data_api_error:<message>`.
