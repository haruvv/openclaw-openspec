## Context

The current paper runner creates decisions from inbound market signals and can execute paper SELL signals if a position exists. That supports externally-triggered exits, but the operator cannot ask Exit Agent to review an open position from the portfolio dashboard.

The existing runner already has the right safety properties: canonical agents, Risk Manager veto, confidence threshold, ledger checks, learning feedback, and paper-only execution. Exit review should reuse that path rather than creating a separate trade path.

## Goals / Non-Goals

**Goals:**

- Review an open internal paper position on demand.
- Include position facts such as average entry, mark price, unrealized PnL, and holding period in the signal context.
- Persist the review as an AI decision and show it in existing AI decision views.
- Allow paper SELL execution only through existing confidence, risk, and ledger gates.

**Non-Goals:**

- Real broker execution.
- Autonomous scheduled position monitoring.
- Partial exits or trailing-stop order management.
- Provider-based live mark refresh.

## Decisions

1. Use a synthetic market signal for exit reviews.

   The runner will create a `position_exit_monitor` signal payload and call the same `processStockMarketSignal` path. This preserves the existing decision, agent, trade, ledger, and learning behavior.

2. Start with manual operator-triggered review.

   A button on open positions triggers the review. Scheduled monitoring can be added later once live market data ingestion is stronger.

3. Default suggested action is SELL, but gates decide outcome.

   Exit review asks whether the position should be closed. If confidence or risk gates do not pass, the review remains a decision without paper execution.

4. Avoid creating market scanner candidates from exit reviews.

   Exit reviews are post-entry monitoring, not new candidate discovery.

## Risks / Trade-offs

- Synthetic signal lacks fresh external market data → Use current ledger mark and visible position facts; future provider integration can refresh marks first.
- SELL suggestion may be too aggressive → Existing confidence threshold and Risk Manager veto prevent low-confidence paper exits.
- Manual trigger is not full automation → It still closes the design gap for explainable Exit Agent decisions and sets up later scheduling.
