## Why

RevenueAgentPlatform and OpenClaw Gateway now work together locally, and the OpenClaw-facing API has production safety controls. The next step is to define a deployable production topology so OpenClaw can invoke RevenueAgentPlatform through a stable HTTPS URL protected by Cloudflare.

## What Changes

- Define the production deployment target for RevenueAgentPlatform.
- Put Cloudflare in front of the RevenueAgentPlatform HTTPS API for TLS, routing, and rate limiting.
- Define required production secrets and environment variables for RevenueAgentPlatform and OpenClaw Gateway.
- Keep `REVENUE_AGENT_ALLOW_EMAIL`, `REVENUE_AGENT_ALLOW_TELEGRAM`, and `REVENUE_AGENT_ALLOW_PAYMENT_LINK` disabled by default for first production deployment.
- Add deploy verification steps that start with side-effect-free RevenueAgent runs.
- Document rollback and operational checks for the first production release.

## Capabilities

### New Capabilities
- `revenue-agent-platform-deployment`: Defines production deployment, Cloudflare protection, secrets, verification, and rollback requirements for RevenueAgentPlatform.

### Modified Capabilities
- `revenue-agent-api-security`: Require production deployment to configure the Cloudflare-facing security controls and default-disabled side-effect policy defined by the secured API.
- `openclaw-revenue-agent-integration`: Require OpenClaw Gateway production configuration to point at the deployed RevenueAgentPlatform base URL with the shared integration token.

## Impact

- Affected code/config: deployment manifests or hosting configuration, production environment variables, Cloudflare route/rate-limit configuration, OpenClaw Gateway production env.
- Affected systems: RevenueAgentPlatform, OpenClaw Gateway, Cloudflare, Firecrawl, Gemini/Z.ai or alternate LLM provider, SendGrid, Telegram, Stripe.
- Operational impact: introduces a stable production URL and a staged rollout path where side effects remain disabled until manually enabled.
- Security impact: production traffic must use HTTPS, bearer-token auth, Cloudflare rate limiting, SSRF protection, and secret-safe logging.
