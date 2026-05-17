## Context

The TradingView webhook runner is intentionally simple: TradingView sends alert JSON to `/webhooks/stock-trading/tradingview`, the backend validates `TRADINGVIEW_WEBHOOK_SECRET`, persists a signal, and then creates a paper-only decision/execution when eligible. The missing piece is operational visibility for configuring and verifying TradingView alerts.

## Goals / Non-Goals

**Goals:**

- Show the exact webhook endpoint from the browser's current origin.
- Show the accepted authentication mechanism without exposing the secret value.
- Provide a JSON alert template aligned with the parser fields.
- Show the latest signal status and timestamp.
- Keep the settings screen useful when the secret is not configured yet.

**Non-Goals:**

- Creating TradingView alerts through an external API.
- Storing or displaying webhook secrets in the admin UI.
- Adding real broker execution.
- Adding a new market data stream.

## Decisions

1. Build the URL client-side from `window.location.origin`.

   The admin UI and webhook live on the same production origin behind Cloudflare. Deriving the URL client-side avoids adding environment-specific public base URL configuration.

2. Return only latest signal metadata from settings.

   Settings should answer "is it configured and did it receive anything?" without duplicating the full signals page. The existing signals list remains the detailed audit view.

3. Show a static JSON template.

   TradingView alert messages are configured by the operator. A static template with placeholders is more transparent than a hidden generator and remains safe because it does not include the secret value.

## Risks / Trade-offs

- Client-side origin can be wrong in unusual reverse-proxy setups. Mitigation: the current Cloudflare Worker deployment serves admin UI and webhook from the same origin.
- A static template can drift from parser behavior. Mitigation: add UI tests asserting key fields are rendered and keep the parser tolerant of common aliases.
- Operators still need to create alerts in TradingView manually. Mitigation: show all required fields and latest-signal verification state in one settings panel.
