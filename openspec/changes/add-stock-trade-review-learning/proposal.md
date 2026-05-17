## Why

The stock trading app can now ingest market signals, create AI paper decisions, execute internal paper trades, maintain positions, and provide research context. The original design also requires the AI to review completed trades, extract lessons, and use those lessons to improve future decisions, but completed paper trades are not yet automatically turned into review or learning records.

## What Changes

- Add an automatic stock trade review flow for closing paper trades.
- Generate structured review summaries from realized trade outcomes, linked AI decisions, agent opinions, research context, and execution details.
- Persist learning items for wins, losses, risk issues, rule candidates, and prohibited patterns.
- Expose review-generated learning in the existing stock trading Lessons UI/API.
- Keep the flow paper-only; no broker order, cancel, transfer, account, or position mutation APIs are introduced.

## Capabilities

### New Capabilities

- `stock-trade-review-learning`: Reviews completed stock paper trades and records reusable learning items.

### Modified Capabilities

None.

## Impact

- Extends stock trading repository and paper runner review behavior.
- Adds review metadata fields where needed to prevent duplicate lesson creation.
- Updates admin API/UI data shape only if required by the review output.
- Adds migration/local fallback schema changes if review state needs persistence.
- Adds repository, runner, route, and UI tests for completed-trade learning records.
