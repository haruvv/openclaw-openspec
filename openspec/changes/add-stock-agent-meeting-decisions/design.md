## Context

The stock runner currently creates one AI decision per TradingView signal and stores agent opinions in `stock_agent_decisions`. LLM mode can return several agents, but deterministic fallback only returns a small subset. Operators need a consistent "AI investment meeting" shape regardless of provider availability.

## Goals / Non-Goals

**Goals:**

- Store a complete canonical agent set for every market-signal decision.
- Preserve LLM-provided opinions when available and fill missing agents deterministically.
- Make the decision detail UI read as an agent meeting.
- Keep Risk Manager veto behavior intact.

**Non-Goals:**

- Real broker execution.
- Running each agent as a separate asynchronous job.
- Adding external market/news collectors.
- Automatically changing strategy rules from the meeting.

## Decisions

1. Normalize agent output before persistence.

   The runner will complete missing canonical agent opinions after deterministic or LLM planning and before `createStockAiDecision`. This keeps repository schema unchanged and avoids backfilling.

2. Keep canonical agent names stable.

   The canonical names are `market-scanner`, `fundamental`, `news`, `technical`, `entry`, `exit`, `risk`, `portfolio`, `review-learning`, `knowledge-curator`, and `judge`. This covers the original document's specialists while preserving existing `risk` checks.

3. Deterministic fills are explicit about unavailable context.

   If fundamentals/news/review context is unavailable, the generated opinion says so instead of inventing facts. This is preferable to hiding missing inputs.

4. UI displays the meeting count and paper-only context.

   Operators should see that a real-time signal produced a paper-only AI meeting and can inspect every agent's score, stance, summary, and reasoning.

## Risks / Trade-offs

- Filled agent opinions are less rich than true independent LLM calls. Mitigation: label uncertainty in summaries and preserve LLM opinions when present.
- More agent rows per decision increases storage volume. Mitigation: rows are small and bounded to the canonical set.
- Canonical names may evolve. Mitigation: stable names are simple strings and can be expanded later without migration.
