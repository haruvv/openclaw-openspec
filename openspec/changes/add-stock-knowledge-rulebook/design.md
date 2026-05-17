## Context

Learning items currently capture wins, losses, blocked patterns, and strategy notes. They are included as recent lesson context, but the system does not distinguish durable rules from raw observations. The design document expects Knowledge Curator to extract reusable rules, prohibited patterns, and skill improvements.

This change adds a first rulebook layer without writing to external skill files. Operators can activate rules after review. Active rules are sent to the AI investment meeting as stable guidance.

## Goals / Non-Goals

**Goals:**

- Persist reusable rule candidates derived from learning items.
- Let operators activate or reject rule candidates.
- Include active rules in future LLM stock decisions.
- Show the rulebook in the stock admin UI.

**Non-Goals:**

- Editing local Codex skill files automatically.
- Autonomous strategy parameter mutation.
- Real broker execution.
- Complex semantic deduplication across similar rules.

## Decisions

1. Create `stock_trading_rules`.

   Rules store category, title, rule text, confidence, status, source learning item, and timestamps. A unique `source_learning_item_id` prevents duplicate rule creation from the same lesson.

2. Derive rule candidates at learning creation time.

   When paper-trade review creates learning items, the repository creates candidate rules for winning patterns, losing patterns, rule candidates, blocked patterns, and strategy notes. This keeps Knowledge Curator output close to the learning event.

3. Active rules are prompt context only.

   The runner includes active rules in the LLM payload as `rulebookContext`. Deterministic fallback does not change behavior from rules yet, which keeps rule effects explicit and testable.

4. Operator status controls adoption.

   Rules start as `candidate`. Operators can set `active` or `rejected`. This avoids automatically enforcing unreviewed lessons.

## Risks / Trade-offs

- Rule candidates can be noisy → Keep candidate status until operator activation.
- Rules may become stale → Preserve timestamps and confidence; future work can add aging.
- Active rules only guide LLM decisions → This is safer than hidden deterministic rule changes.
- Similar lessons may produce similar rules → Unique source dedupe is enough for this MVP.

## Migration Plan

1. Add `stock_trading_rules` migration and local fallback schema.
2. Existing learning items do not backfill automatically.
3. New learning items create rule candidates.
4. Rollback is safe because rules are advisory prompt context only.
