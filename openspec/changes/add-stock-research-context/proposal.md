## Why

The LLM stock agents currently receive price signal, indicator, portfolio, and position context, but they must mark fundamentals, news, filings, and sector context as unavailable. The original design requires those materials to influence AI decisions and be visible in the WebApp.

## What Changes

- Add a stock research context store for news, earnings, disclosures, fundamentals, macro, sector, and operator notes.
- Expose recent research context through admin API and UI.
- Allow authorized operators to add research context manually while external collectors are still future work.
- Include recent symbol-specific and market-wide research context in LLM decision prompts.
- Keep all research context as decision input only; no real broker execution is introduced.

## Capabilities

### New Capabilities
- `stock-research-context`: Stores and exposes stock research materials used by AI trading agents.

### Modified Capabilities
None.

## Impact

- Adds D1 migration and local fallback schema for `stock_research_items`.
- Extends stock trading repository, admin API, UI types, and dashboard/settings views.
- Updates LLM decision prompt payload with recent research context.
- Adds schema, repository, admin route, UI, and runner tests.
