## Context

The stock trading admin app is now deployed as a paper-only dashboard backed by D1 through the existing durable-http storage bridge. It can persist and display AI decisions, specialist opinions, paper trades, portfolio snapshots, learning items, and provider readiness. It does not yet collect live or near-real-time market signals, generate decisions, or create simulated trades.

The fastest safe path is to make TradingView webhook alerts the first market-signal source. TradingView can compute chart conditions and send compact payloads without requiring a resident market-data stream or a broker API session. The backend can treat those payloads as untrusted external input, authenticate them with `TRADINGVIEW_WEBHOOK_SECRET`, persist them, and run a paper-only decision service.

Production remains Cloudflare Worker plus Container. Worker protects admin routes with Cloudflare Access and forwards relevant webhooks to the Container. Container code writes operational state through durable-http into D1/R2. SQLite remains local/test fallback only.

## Goals / Non-Goals

**Goals:**

- Accept TradingView-style webhook signals for configured symbols and timeframes.
- Persist market signal payloads and expose them in the stock trading admin UI.
- Generate structured AI decisions from signal context without placing real orders.
- Create internal paper trades only when the decision is actionable and passes safety gates.
- Update paper portfolio snapshots after simulated executions.
- Keep the implementation provider-light and testable without live market data or broker credentials.
- Preserve the existing `/api/admin/*` API contract and Cloudflare Access behavior.

**Non-Goals:**

- Real broker order placement, cancellation, fund transfer, account mutation, or broker account reconciliation.
- Continuous websocket market-data streaming.
- Full backtesting, walk-forward optimization, or historical candle warehousing.
- Direct TradingView chart embedding as a hard dependency.
- Autonomous live trading or financial advice claims.

## Decisions

1. Use TradingView webhook as the first signal source.

   TradingView alerts are a pragmatic first input because they can send symbol, timeframe, close price, indicators, and strategy tags. A moomoo OpenAPI stream would be valuable later, but it adds session management, provider-specific reliability concerns, and market-hours behavior before the AI runner needs them.

2. Store signals in a dedicated `stock_market_signals` table.

   Signals are distinct from decisions and trades. They need their own status, source, raw payload, normalized OHLCV fields, indicator JSON, and created timestamp. This keeps replay/debugging possible and prevents decisions from becoming the only record of what the AI saw.

3. Make the runner synchronous for the webhook MVP.

   The first implementation can process a webhook in the request path: persist signal, run deterministic AI-decision generation or configured LLM fallback, optionally create a paper trade, update a portfolio snapshot, and return the result. A queue can be added later if provider latency becomes a production issue. Tests can cover the synchronous flow directly.

4. Use a conservative paper execution model.

   Only `BUY` and `SELL` decisions with confidence above a configured threshold create paper trades. `WATCH` and rejected decisions create decision logs but no trade. Paper quantity is derived from a small configurable notional budget and the signal price. Executions use the signal price and are marked `paper`; raw execution metadata points back to the signal and decision.

5. Use existing AI provider abstractions where available, but keep deterministic fallback.

   The runner should be useful in local tests and production even when optional AI provider credentials are unavailable. The service can build structured decisions using deterministic rules from signal indicators first, then later swap in LLM-based multi-agent reasoning behind the same repository contract.

6. Treat all webhook input as untrusted.

   Webhook requests must require `TRADINGVIEW_WEBHOOK_SECRET`. The handler validates required fields, caps raw payload size, normalizes known values, and rejects invalid prices or unsupported actions. The secret is never returned in API responses or UI.

7. Keep admin UI additive.

   The existing stock trading pages should gain recent signal and runner status visibility without replacing the dashboard. The UI should continue to show empty states clearly and label executions as internal paper/demo/manual state.

## Risks / Trade-offs

- Synchronous webhook processing may time out if future LLM calls are slow. Mitigation: keep MVP runner lightweight and add queue-based processing later if needed.
- TradingView alerts can be misconfigured or duplicated. Mitigation: persist raw payload, include source IDs when provided, and make duplicate handling idempotent around alert IDs when available.
- Paper fills at signal price can be unrealistic. Mitigation: label fills as internal paper execution and preserve the signal timestamp/price as metadata.
- Deterministic fallback is less sophisticated than a full AI investment committee. Mitigation: store decision reasoning and agent opinions in the same schema so LLM agents can replace the fallback without UI changes.
- New webhook surface increases attack surface. Mitigation: require shared-secret auth, reject malformed payloads, never expose secrets, and keep broker mutation code absent.

## Migration Plan

1. Add `stock_market_signals` table and indexes through D1 migration and local fallback schema.
2. Add repository methods for creating/listing signal records and loading runner context.
3. Add TradingView webhook auth and parsing route.
4. Add paper runner service that creates decisions, optional paper trades, and portfolio snapshots.
5. Extend admin API and UI with recent signals and runner status.
6. Add tests for webhook auth, malformed payloads, signal persistence, decision/trade creation, and paper-only behavior.

Rollback is low risk: disable or remove the webhook route and keep the added table unused. Existing stock trading dashboard records remain readable.

## Open Questions

- Which initial watchlist should production alerts cover: US equities only, Japanese equities, or both?
- Should webhook duplicate detection use TradingView alert IDs when supplied, or a content hash when not supplied?
- What default notional budget per paper trade should production use?
