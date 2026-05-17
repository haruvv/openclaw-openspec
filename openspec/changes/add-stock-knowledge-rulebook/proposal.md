## Why

The app records learning logs and feeds them back as context, but it does not yet show how those lessons become reusable trading rules. The design goal requires Knowledge Curator to extract rule candidates and make the next decision rules visible.

## What Changes

- Add a stock trading rulebook for reusable rules extracted from learning items.
- Automatically create rule candidates from paper-trade learning items.
- Allow operators to activate or reject rules.
- Include active rulebook entries in future LLM decision payloads.
- Add a rulebook page and dashboard panel so operators can see which rules changed.

## Capabilities

### New Capabilities

- `stock-knowledge-rulebook`: Converts learning items into reusable stock trading rules and feeds active rules into AI decisions.

### Modified Capabilities

None.

## Impact

- Adds a D1 migration and local schema for `stock_trading_rules`.
- Extends repository, paper runner prompt context, admin API, and admin UI.
- Adds repository, runner, route, and UI tests.
- Keeps execution paper-only; rules affect AI context, not direct broker actions.
