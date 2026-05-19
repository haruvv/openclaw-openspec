## Why

The app can collect candles, scan candidates, and manually convert candidates into AI paper decisions, but the design goal is an AI demo-trading loop that can keep learning from real chart data. Operators should not need to press three separate buttons for every cycle.

## What Changes

- Add an autonomous stock paper cycle that runs market data collection, candle scanning, and candidate conversion in one workflow.
- Convert eligible provider candidates into existing AI investment meeting decisions and internal paper executions.
- Add an internal authenticated job endpoint for scheduled execution.
- Add an admin API/UI action to run the cycle manually and inspect the result.
- Keep real broker execution disabled; the cycle only uses existing paper-only decision and ledger paths.

## Capabilities

### New Capabilities
- `stock-autonomous-paper-cycle`: Runs the stock demo-trading loop from market data collection through paper AI decision conversion.

### Modified Capabilities
None.

## Impact

- Adds a stock automation service and candidate conversion helper.
- Extends admin API/UI and internal job routing.
- Extends Cloudflare container scheduled forwarding.
- Adds service, route, and UI tests.
