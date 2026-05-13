# OpenClaw Revenue Agent Integration

This document defines how OpenClaw should call RevenueAgentPlatform as one high-level business action.

## Endpoint

```http
POST /api/revenue-agent/run
Authorization: Bearer <REVENUE_AGENT_INTEGRATION_TOKEN>
Content-Type: application/json
```

## Request

```json
{
  "url": "https://example.com",
  "sendEmail": false,
  "sendTelegram": false,
  "createPaymentLink": false
}
```

Fields:

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `url` | yes | none | Target URL to crawl, score, and generate a proposal for. Must be `http` or `https`. |
| `sendEmail` | no | `false` | Requests the SendGrid smoke-style email. The server also requires `REVENUE_AGENT_ALLOW_EMAIL=true`. |
| `sendTelegram` | no | `false` | Requests the Telegram notification. The server also requires `REVENUE_AGENT_ALLOW_TELEGRAM=true`. |
| `createPaymentLink` | no | `false` | Requests a Stripe Payment Link. The server also requires `REVENUE_AGENT_ALLOW_PAYMENT_LINK=true`. Use test keys until production policy is finalized. |

Default behavior is dry-run style: crawl, score, and proposal generation only. Side effects are opt-in twice: the caller must request them and the server-side policy flag must allow them.

## Response

```json
{
  "id": "2026-05-13T00-00-00-000Z-...",
  "targetUrl": "https://example.com",
  "startedAt": "2026-05-13T00:00:00.000Z",
  "completedAt": "2026-05-13T00:00:30.000Z",
  "status": "passed",
  "steps": [
    {
      "name": "crawl_and_score",
      "status": "passed",
      "durationMs": 15000,
      "details": {
        "domain": "example.com",
        "seoScore": 80,
        "diagnostics": 11
      }
    }
  ],
  "outputs": {
    "domain": "example.com",
    "seoScore": 80,
    "proposalPath": "output/proposals/example.com.md",
    "paymentLinkUrl": "https://buy.stripe.com/test_..."
  }
}
```

`paymentLinkUrl` is present only when `createPaymentLink` is true and Stripe succeeds.

## Required Environment

RevenueAgentPlatform:

```dotenv
REVENUE_AGENT_INTEGRATION_TOKEN=<shared-secret>
REVENUE_AGENT_RATE_LIMIT_PER_MINUTE=60
REVENUE_AGENT_ALLOW_EMAIL=false
REVENUE_AGENT_ALLOW_TELEGRAM=false
REVENUE_AGENT_ALLOW_PAYMENT_LINK=false
FIRECRAWL_API_KEY=...
GEMINI_API_KEY=...
ZAI_API_KEY=...
```

Generate `REVENUE_AGENT_INTEGRATION_TOKEN` as a long random value, for example:

```bash
openssl rand -hex 32
```

Optional side-effect providers:

```dotenv
SENDGRID_API_KEY=...
SENDGRID_FROM_EMAIL=...
SENDGRID_FROM_NAME=RevenueAgentPlatform
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
STRIPE_SECRET_KEY=sk_test_...
```

OpenClaw Gateway:

```dotenv
REVENUE_AGENT_BASE_URL=http://localhost:3000
REVENUE_AGENT_INTEGRATION_TOKEN=<same-shared-secret>
```

## Production Security

The run endpoint is intended for machine-to-machine calls from OpenClaw Gateway, not browser clients.

Required production controls:

- Serve the API only over HTTPS.
- Put the API behind Cloudflare.
- Configure Cloudflare Rate Limiting for `POST /api/revenue-agent/run`; the application also has `REVENUE_AGENT_RATE_LIMIT_PER_MINUTE` as a local fallback.
- Keep CORS closed unless a separate browser-facing client is intentionally introduced.
- Keep `REVENUE_AGENT_ALLOW_EMAIL`, `REVENUE_AGENT_ALLOW_TELEGRAM`, and `REVENUE_AGENT_ALLOW_PAYMENT_LINK` set to `false` until each side effect is manually verified in production.
- Do not log `Authorization` headers, integration tokens, provider API keys, Telegram bot tokens, or Stripe secrets.

The API rejects unsafe crawl targets before starting expensive work:

- unsupported schemes such as `file:`
- `localhost`
- loopback, private, link-local, multicast, and metadata IP ranges
- hostnames that resolve to those address ranges

## Local Verification

Start RevenueAgentPlatform:

```bash
REVENUE_AGENT_INTEGRATION_TOKEN=dev-token npm run dev
```

Call the endpoint with side effects disabled:

```bash
curl -sS http://localhost:3000/api/revenue-agent/run \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "sendEmail": false,
    "sendTelegram": false,
    "createPaymentLink": false
  }'
```

Expected result:

- HTTP 200 when the run is passed or skipped.
- HTTP 502 when the run reaches a failed pipeline status.
- JSON includes `steps` and `outputs`; no logs need to be parsed.

## OpenClaw Skill Draft

Create this in the OpenClaw Gateway repo as `skills/revenue-agent/SKILL.md` when wiring the systems together.

````markdown
---
name: revenue-agent
description: Run RevenueAgentPlatform for a target URL. Use for SEO/business evaluation, proposal generation, and optional outreach/payment-link actions.
---

# Revenue Agent

Run the RevenueAgentPlatform pipeline as one business action.

## When to use

- The user asks to evaluate a website for sales or SEO opportunities.
- The user asks to generate a proposal for a target website.
- The user explicitly approves outreach, Telegram notification, or Stripe Payment Link creation.

## Safety

- Default to no side effects.
- Do not set `sendEmail`, `sendTelegram`, or `createPaymentLink` to true unless the user clearly approves that action.
- Treat `createPaymentLink` as an L3 action.

## Invocation

Call:

```bash
curl -sS "$REVENUE_AGENT_BASE_URL/api/revenue-agent/run" \
  -H "Authorization: Bearer $REVENUE_AGENT_INTEGRATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<target-url>",
    "sendEmail": false,
    "sendTelegram": false,
    "createPaymentLink": false
  }'
```

## Response handling

- Summarize `status`, `outputs.seoScore`, `outputs.proposalPath`, and each step status.
- If `outputs.paymentLinkUrl` exists, show it only after confirming the user intended to create a Stripe link.
- If a step failed, report the sanitized `error` from that step.
````
