## Why

The stock trading workflow can evaluate and paper-trade symbols once a TradingView signal arrives, but it still depends on external/manual selection of symbols. The design goal requires the AI trader to surface short-to-mid-term theme stock candidates before the investment meeting.

## What Changes

- Add market scanner candidate persistence for AI-discovered watch candidates.
- Generate candidates from inbound TradingView signals and manually entered research context.
- Track candidate theme, sector, reason, score, source, and lifecycle status.
- Expose candidate list and status update APIs to authorized stock trading operators.
- Add an admin UI page for AI candidate symbols and a dashboard panel.
- Allow operators to convert a candidate into a paper-only AI investment meeting.

## Capabilities

### New Capabilities

- `stock-market-scanner-candidates`: Stores, displays, and advances AI market scanner candidate symbols before paper trading decisions.

### Modified Capabilities

None.

## Impact

- Adds a D1 migration and local schema for `stock_market_candidates`.
- Extends stock repository, admin routes, and paper runner candidate creation.
- Adds a candidate-to-decision API path that reuses paper-only decision gates.
- Updates admin UI navigation, types, dashboard, and tests.
