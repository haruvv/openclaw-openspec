## Why

RevenueAgentPlatform is now callable from OpenClaw, but production use requires exposing the run API beyond local development. Because the run API can trigger crawling, LLM usage, Telegram notifications, SendGrid email, and Stripe Payment Link creation, it must reject abusive or unsafe requests before it is deployed behind Cloudflare.

## What Changes

- Harden `POST /api/revenue-agent/run` for production invocation from OpenClaw.
- Require a strong bearer token and return consistent unauthorized responses without leaking credential details.
- Add request rate limiting suitable for Cloudflare deployment, with a local fallback for non-Cloudflare development.
- Validate target URLs before crawling to prevent SSRF against localhost, private networks, link-local metadata endpoints, and unsupported schemes.
- Enforce a server-side side-effect policy so email, Telegram, and Stripe actions cannot be enabled only by client-supplied flags.
- Ensure API responses and logs do not expose integration tokens or provider secrets.
- Document the production Cloudflare environment contract needed by OpenClaw Gateway and RevenueAgentPlatform.

## Capabilities

### New Capabilities
- `revenue-agent-api-security`: Defines authentication, rate limiting, URL safety validation, side-effect policy, and secret-handling requirements for the OpenClaw-facing RevenueAgentPlatform API.

### Modified Capabilities
- None.

## Impact

- Affected code: RevenueAgentPlatform HTTP server, revenue agent request validation, pipeline run authorization boundary, logging/error sanitization, environment configuration.
- Affected tests: API authorization cases, rate-limit behavior, URL validation/SSRF rejection, side-effect policy enforcement, regression coverage for safe local runs.
- Affected deployment: Cloudflare-facing production configuration, `REVENUE_AGENT_BASE_URL`, `REVENUE_AGENT_INTEGRATION_TOKEN`, and any Cloudflare rate limit binding or proxy rule used by the deployed API.
- Affected integrations: OpenClaw Gateway `revenue-agent` skill, Telegram, SendGrid, Stripe, LLM provider usage, and crawler outbound network behavior.
