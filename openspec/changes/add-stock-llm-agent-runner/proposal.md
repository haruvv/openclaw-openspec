## Why

The stock paper runner currently creates paper decisions with deterministic rules. The original design calls for specialist AI agents, a Judge Agent, and a Risk Manager veto so the app records why a trade was approved or rejected from multiple perspectives.

## What Changes

- Add an optional LLM-backed stock multi-agent decision runner.
- Build structured agent opinions for market, fundamental, news, technical, entry, exit, risk, portfolio, and judge roles.
- Enforce Risk Manager veto before paper execution.
- Keep deterministic fallback when LLM credentials are not configured or the LLM response is invalid.
- Persist LLM-generated agent opinions through the existing stock AI decision tables.
- Keep all executions paper-only.

## Capabilities

### New Capabilities
- `stock-llm-agent-runner`: Generates stock paper-trading decisions with LLM-backed specialist agents and risk veto.

### Modified Capabilities
None.

## Impact

- Updates stock paper runner decision generation.
- Uses the existing `generateText` LLM provider abstraction.
- Adds tests for LLM decision parsing, fallback, and risk veto behavior.
