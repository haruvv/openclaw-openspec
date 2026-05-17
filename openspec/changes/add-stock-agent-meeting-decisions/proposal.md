## Why

TradingView webhook signals can already trigger paper decisions and internal demo trades, but the saved decision is not consistently represented as a full agent meeting. The product goal is to let operators see how the specialized stock agents evaluated each real-time chart signal before demo trading and later learning.

## What Changes

- Treat every TradingView stock signal as one AI investment meeting input event.
- Ensure each saved AI decision includes a canonical set of agent opinions, even when the system falls back to deterministic decisions.
- Expand LLM instructions to require market, fundamental, news, technical, entry, exit, risk, portfolio, review/learning, knowledge, and judge opinions.
- Improve the AI decision detail UI so operators can inspect the full meeting rather than a partial agent list.
- Keep demo trading paper-only; no real broker execution is introduced.

## Capabilities

### New Capabilities

- `stock-agent-meeting-decisions`: Stores and displays full stock agent meeting decisions for real-time signal events.

### Modified Capabilities

None.

## Impact

- Updates stock paper runner decision normalization and prompt payload.
- Updates admin UI wording/detail display for agent meetings.
- Adds runner and UI tests for full agent meeting persistence.
