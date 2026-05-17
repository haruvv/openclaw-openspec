## Context

The stock trading runner now records TradingView signals, AI decisions, canonical agent opinions, internal paper trades, positions, portfolio snapshots, strategy performance, backtests, research context, and post-trade learning items. The missing loop is that `stock_learning_items` are visible in the UI but not reused as bounded context for the next AI decision.

The runner already builds a structured LLM payload containing signal, indicator, portfolio, position, and research facts. Learning feedback should extend that payload without changing the paper-only execution model or requiring a new external dependency.

## Goals / Non-Goals

**Goals:**

- Feed recent learning items into future stock LLM decisions.
- Keep the lesson context bounded and deterministic.
- Persist which learning items were attached to each decision.
- Show attached lessons in the AI decision detail UI.
- Keep all execution paper-only and keep existing confidence, ledger, and Risk Manager gates.

**Non-Goals:**

- Writing lessons into a filesystem skill repo automatically.
- Creating real broker orders or broker mutations.
- Running separate asynchronous learning agents.
- Adding external market/news collectors.
- Automatically rewriting strategy parameters from lessons.

## Decisions

1. Add a decision-learning reference table.

   The system will store `stock_decision_learning_refs` rows linking an AI decision to the learning items included in its prompt. This avoids duplicating lesson bodies into the decision row and lets the detail API render exact provenance.

2. Select bounded lessons before LLM generation.

   The runner will load recent lessons once per signal, pass them into the LLM payload, and attach the same selected lessons after the decision is saved. This makes tests deterministic and prevents the UI from showing a different set than the model saw.

3. Use current lesson data as structured context.

   Learning context will include category, title, body, confidence, source trade id, applied-to-skill status, and created time. The LLM is instructed to treat lessons as historical paper-trade observations, not facts about the current market.

4. Keep deterministic fallback unchanged except for provenance storage.

   If LLM mode is unavailable, the runner may still attach recent lessons to the decision detail for operator visibility, but deterministic action rules remain unchanged. This prevents historical notes from creating hidden behavior in fallback mode.

5. Do not overload `appliedToSkill`.

   `appliedToSkill` remains a lesson state. This change displays it in decision context but does not add skill export or mutation workflows.

## Risks / Trade-offs

- Older or low-quality lessons may bias decisions → Bound the context and include confidence/category so agents can discount weak lessons.
- Extra rows increase storage volume → Store only references from decisions to selected learning item ids.
- Lessons created after a decision could appear confusing → Persist exact refs at decision time and render only those refs on the detail page.
- Deterministic fallback does not use lessons for action selection → This is intentional until learning-derived rule changes are implemented explicitly and tested.

## Migration Plan

1. Add a D1 migration and local fallback schema for `stock_decision_learning_refs`.
2. Deploy schema before relying on decision-learning provenance in production.
3. Existing decisions have no lesson refs and should render an empty attached-lessons state.
4. Rollback is safe because the runner can operate without historical refs if the new code is reverted with the migration table left in place.
