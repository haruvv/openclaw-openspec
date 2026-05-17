## Why

The stock trading app already creates learning logs from completed paper trades, but those lessons are not fed back into later AI decisions. This leaves the system recording reflections without using them to improve future demo trading.

## What Changes

- Include recent stock learning items in the paper runner's LLM decision payload.
- Prefer symbol-specific, strategy-relevant, and market-wide lessons as bounded decision context.
- Preserve paper-only execution and existing risk gates while allowing review-learning and knowledge-curator agents to cite prior lessons.
- Show which lessons were used by a saved AI decision in the decision detail UI.
- Add tests proving saved lessons influence the next LLM decision payload and remain visible to operators.

## Capabilities

### New Capabilities

- `stock-learning-feedback-loop`: Feeds prior paper-trade lessons into subsequent stock AI decisions and displays the lesson context used by each decision.

### Modified Capabilities

None.

## Impact

- Adds a small decision-to-learning reference table and migration for durable D1 storage.
- Extends stock repository methods, local fallback schema, runner payload construction, and admin API detail responses.
- Updates admin UI decision detail types and rendering.
- Adds runner, repository, and UI tests.
