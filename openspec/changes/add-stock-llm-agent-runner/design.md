## Context

The paper runner receives TradingView signals, persists market signals, creates stock AI decisions, and may create paper trades. The current decision builder is deterministic. It provides a safe baseline, but it does not match the design document's agent architecture where specialist agents disagree, Risk Manager can veto, and Judge integrates the final action.

The repo already has an LLM provider abstraction with Gemini and Z.ai fallback. Stock trading should reuse that provider and avoid new dependencies. LLM availability must remain optional so local tests and production without keys still work.

## Goals / Non-Goals

**Goals:**

- Use an LLM to generate structured agent opinions when LLM credentials are configured.
- Preserve deterministic fallback when LLM is unavailable or invalid.
- Include available signal, indicator, portfolio, and position context in the LLM prompt.
- Persist the LLM output as existing `stock_ai_decisions` and `stock_agent_decisions`.
- Enforce Risk Manager veto before paper trade creation.

**Non-Goals:**

- Fetching news, fundamentals, filings, or live market data in this change.
- Backtesting or post-trade learning automation.
- Real broker execution.
- Guaranteeing financial correctness of LLM opinions.

## Decisions

1. Use `STOCK_AI_DECISION_MODE=auto|llm|deterministic`.

   `auto` uses LLM only when provider credentials exist. `llm` attempts LLM and falls back on invalid response/provider failure. `deterministic` keeps the current behavior for tests and incident fallback.

2. Keep one final decision schema.

   The LLM returns final action, confidence, risk factors, take-profit/stop-loss, and agent opinions. This maps directly into existing persistence and UI, avoiding new tables.

3. Treat missing external data as explicit context.

   Until news/fundamental collectors exist, the LLM prompt states that those data are unavailable. Agents must mark uncertainty instead of inventing facts.

4. Risk veto is enforced in code, not trusted to the LLM.

   If the risk agent stance is `reject`, the runner downgrades actionable BUY/SELL to `WATCH` and records a risk factor. This prevents paper execution even if Judge recommends a trade.

## Risks / Trade-offs

- LLM output can be malformed. Mitigation: strict parser plus deterministic fallback.
- LLM may invent facts. Mitigation: prompt instructs use of provided facts only and unavailable external data is explicit.
- LLM latency can slow webhook processing. Mitigation: mode can be set to deterministic; queueing can be added later.
- Risk veto may block good trades. Mitigation: veto reason is persisted as an agent opinion and decision risk factor.
