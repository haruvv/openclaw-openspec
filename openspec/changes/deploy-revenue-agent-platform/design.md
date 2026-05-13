## Context

RevenueAgentPlatform currently runs locally and exposes a secured OpenClaw-facing API. OpenClaw Gateway can invoke that API when both systems are running locally, but production still needs a stable HTTPS endpoint, production secrets, Cloudflare protection, and a staged verification plan.

The first production deployment should minimize blast radius: side effects stay disabled, OpenClaw points at the deployed API only after direct API verification, and LLM provider availability is handled separately from deployment mechanics.

## Goals / Non-Goals

**Goals:**

- Deploy RevenueAgentPlatform behind Cloudflare with HTTPS.
- Preserve the existing `POST /api/revenue-agent/run` contract.
- Configure production secrets without committing secret values.
- Configure OpenClaw Gateway to call the production base URL.
- Verify production with side-effect-free runs before enabling any external side effects.

**Non-Goals:**

- Enable production SendGrid, Telegram, or Stripe side effects by default.
- Solve Z.ai balance/provider fallback in this deployment change.
- Build a multi-tenant deployment or customer admin UI.
- Replace the existing RevenueAgentPlatform API contract.

## Decisions

### Use Cloudflare Containers as the production target

Cloudflare Containers is the selected first production target. It can run the existing Node/Express service and Chromium/Lighthouse dependencies while Cloudflare provides TLS, routing, rate limiting, and a consistent public hostname.

Cloudflare Tunnel plus a separate Node host remains the fallback if Containers blocks progress, but it is not the primary path because it would add host patching, process supervision, and Chrome dependency management outside Cloudflare.

The cost assumption is documented in `docs/revenue-agent-platform-deployment.md`: start from Workers Paid at about $5/month, keep containers idle-sleeping when possible, and treat high crawl volume, Lighthouse runtime, and third-party APIs as the main variable costs.

### Keep side effects disabled for first deployment

The first production verification will use `sendEmail=false`, `sendTelegram=false`, and `createPaymentLink=false`. The server-side flags `REVENUE_AGENT_ALLOW_EMAIL`, `REVENUE_AGENT_ALLOW_TELEGRAM`, and `REVENUE_AGENT_ALLOW_PAYMENT_LINK` remain `false` until each provider is verified manually.

### Configure OpenClaw after direct API verification

OpenClaw Gateway should not be pointed at the production URL until direct `curl` verification passes with the shared bearer token. This keeps LLM/provider issues separate from API deployment issues.

### Treat secrets as deployment configuration

All provider keys and integration tokens will be set as production secrets or environment variables in the hosting platform. `.env.example` remains documentation only.

## Risks / Trade-offs

- Cloudflare Containers may add platform-specific build/deploy work -> keep Cloudflare Tunnel plus another Node host as a documented fallback.
- Container cost can rise with long Chromium/Lighthouse runs -> start with low-frequency manual verification and idle sleep, then review usage before enabling scheduled or high-volume runs.
- LLM provider quota can block proposal generation -> verify crawler/API health separately and track provider fallback as a separate change if needed.
- Side-effect flags may be accidentally enabled -> default all server-side policy flags to `false` and document staged enablement.
- Production secrets can drift from local config -> add an explicit environment checklist and smoke command.

## Migration Plan

1. Use Cloudflare Containers as the hosting path.
2. Configure production environment variables and secrets.
3. Deploy RevenueAgentPlatform and verify `/health`.
4. Call `POST /api/revenue-agent/run` directly with side effects disabled.
5. Update OpenClaw Gateway production env with `REVENUE_AGENT_BASE_URL` and matching token.
6. Verify OpenClaw can call the production API path.
7. Keep side effects disabled until a later provider-specific rollout.
