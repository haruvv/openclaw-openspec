## 1. Provider Implementation

- [x] 1.1 Add env-based provider selection for Twelve Data.
- [x] 1.2 Implement Twelve Data `/time_series` request mapping.
- [x] 1.3 Parse Twelve Data values into existing candle inputs.
- [x] 1.4 Preserve existing custom HTTP adapter behavior.
- [x] 1.5 Forward Twelve Data env vars to the Cloudflare container.

## 2. Verification

- [x] 2.1 Add collector tests for Twelve Data success, missing key, and API error responses.
- [x] 2.2 Run `openspec validate add-twelve-data-stock-provider --strict`.
- [x] 2.3 Run focused stock market data collector tests.
- [x] 2.4 Run `npm test`.
- [x] 2.5 Run `npm run build`.
