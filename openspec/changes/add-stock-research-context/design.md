## Context

The stock trading app now has paper execution, position ledger, TradingView setup visibility, and optional LLM multi-agent decisions. The LLM prompt still states that fundamentals, news, disclosures, and sector flow are unavailable because the system has no place to store them.

This change creates the internal research context layer first. It does not attempt to integrate every external provider immediately. Instead, it gives the WebApp and LLM runner a stable contract that later collectors such as TDnet, EDINET, company IR, or news APIs can write into.

## Goals / Non-Goals

**Goals:**

- Store normalized research items by symbol and category.
- Support market-wide items using a special broad scope when symbol is absent.
- Expose recent research items in stock trading admin UI.
- Allow admin-created research items for immediate production use and testing.
- Feed recent symbol-specific and market-wide research into LLM decision prompts.

**Non-Goals:**

- Implementing TDnet, EDINET, moomoo, or paid news-provider collectors in this change.
- Summarizing or deduplicating external articles automatically.
- Treating research context as financial advice.
- Real broker execution.

## Decisions

1. Use one `stock_research_items` table.

   Categories differ, but the LLM needs the same fields: title, summary, source, URL, sentiment, importance, and published time. One table keeps ingestion and display simple.

2. Make manual admin ingestion the first writer.

   This lets operators add earnings/news/disclosure context now and lets tests validate the end-to-end path without network dependencies. Provider collectors can reuse the same repository method later.

3. Use category and importance rather than provider-specific schema.

   LLM agents need a compact, consistent context. Raw provider payload is retained separately for debugging.

4. Limit prompt context.

   The LLM runner includes a bounded number of recent symbol-specific and market-wide items to keep webhook latency and token usage controlled.

## Risks / Trade-offs

- Manual context can be stale or biased. Mitigation: persist source, published time, and importance; show items in UI so operators can inspect what the AI saw.
- A generic schema loses provider-specific detail. Mitigation: keep `raw_payload_json` for future detailed analysis.
- Prompt context can grow too large. Mitigation: query recent bounded items only.
