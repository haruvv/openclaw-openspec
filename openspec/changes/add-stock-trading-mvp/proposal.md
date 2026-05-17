## Why

The admin platform already has a planned stock trading app entry, but it does not provide an operator surface for testing AI trading decisions without risking real funds. A first stock trading MVP should turn that placeholder into a paper-trading control room where decisions, simulated executions, portfolio movement, and lessons are recorded before any broker-side automation is considered.

## What Changes

- Activate the stock trading business app under `/admin/stock-trading`.
- Add a stock trading dashboard showing virtual capital, equity, cash, realized/unrealized P&L, win rate, and drawdown.
- Add an AI decisions view that records candidate symbols, final action, confidence, strategy tag, reasoning, risk factors, and per-agent opinions.
- Add internal paper-trade records for human-approved or manually entered demo executions, including symbol, side, quantity, price, execution source, and realized outcome.
- Add learning logs that capture post-trade reviews, winning/losing patterns, rule candidates, blocked patterns, and whether a lesson has been applied to a skill or knowledge base.
- Keep the first version explicitly paper-only: no real-money order placement and no destructive broker account actions.
- Allow market-data and broker integrations to be represented as configuration/status placeholders until moomoo, TradingView, or other providers are connected.

## Capabilities

### New Capabilities

- `stock-trading-mvp`: Provides the authenticated stock trading admin app, internal paper-trading records, AI decision logs, portfolio snapshots, learning logs, and paper-only safety boundaries.

### Modified Capabilities

- None.

## Impact

- Adds stock trading backend modules, repository methods, and admin API routes.
- Adds operational storage persistence for AI decisions, agent decision details, paper trades, portfolio snapshots, and learning items, using the existing D1-backed durable storage path in deployed environments.
- Updates the admin business app registry, navigation, and React routes to expose `/admin/stock-trading`.
- Adds stock trading admin UI pages for dashboard, AI decisions, trades, lessons, and integration/settings status.
- Adds tests for persistence, API behavior, route accessibility, and paper-only safety constraints.
- Does not require a new runtime host, real broker credentials, or a database migration away from the current operational storage model.
