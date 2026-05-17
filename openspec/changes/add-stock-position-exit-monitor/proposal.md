## Why

The app can open and close internal paper positions when a signal arrives, but it does not yet let Exit Agent actively review open positions. The design requires the AI trader to explain when to take profit, cut losses, hold, or exit based on the current position and prior rules.

## What Changes

- Add a paper-only exit review action for open stock positions.
- Reuse the existing AI investment meeting and paper runner gates to create SELL/HOLD/WATCH decisions for open positions.
- Expose an admin API to request an exit review for a symbol.
- Add an Exit確認 action to open positions in the admin UI.
- Persist the exit review as a normal AI decision and market signal so it appears in existing decision/trade/learning views.

## Capabilities

### New Capabilities

- `stock-position-exit-monitor`: Lets operators trigger AI exit reviews for open internal paper positions.

### Modified Capabilities

None.

## Impact

- Extends stock paper runner with a position exit review entry point.
- Adds admin route and UI action for exit reviews.
- Adds runner, route, and UI tests.
- No new external dependencies or real broker execution.
