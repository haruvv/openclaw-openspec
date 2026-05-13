## Context

`POST /api/revenue-agent/run` currently exposes the OpenClaw-facing RevenueAgentPlatform run path with bearer-token authentication and basic URL shape validation. Local integration is proven, but production deployment behind Cloudflare will make this API reachable over HTTPS and capable of consuming crawler, LLM, SendGrid, Telegram, and Stripe resources.

The primary caller is OpenClaw Gateway. Browser clients should not call this API directly, and customer-facing side effects must remain opt-in and policy-controlled even if a caller supplies side-effect flags.

## Goals / Non-Goals

**Goals:**

- Keep the API suitable for Cloudflare-protected production deployment.
- Reject unauthenticated requests without revealing token configuration details.
- Limit abusive request volume before expensive crawler or LLM work begins.
- Prevent SSRF by validating target URLs before any network crawler receives them.
- Make side-effecting actions require both caller intent and server-side production policy.
- Keep local development and smoke testing straightforward.

**Non-Goals:**

- Replace OpenClaw Gateway authentication or Telegram authorization.
- Implement payment completion, webhook fulfillment, or HIL production workflows.
- Build a full tenant/customer billing system.
- Guarantee globally strict rate limits across every Cloudflare location in the MVP.

## Decisions

### Use layered rate limiting

The API will enforce an application-level rate-limit check before running the pipeline. In Cloudflare production, this should use a Cloudflare Rate Limiting binding or an edge rule keyed by the integration token or route. In local development, the same interface will fall back to an in-memory fixed-window limiter.

Alternative considered: rely only on Cloudflare WAF/rules. That leaves local and non-Cloudflare deployments without a testable application boundary, so the app keeps a fallback limiter while allowing Cloudflare to carry the production counter.

### Validate target URLs with DNS/IP deny rules

The run API will parse the submitted URL and allow only `http:` and `https:` schemes. It will reject localhost hostnames, raw private/link-local/loopback IPs, and hostnames that resolve to private, loopback, link-local, multicast, or metadata address ranges. Redirect-following crawler behavior remains a risk, so the crawler boundary should receive only validated initial URLs and later add redirect validation if crawler internals expose redirect targets.

Alternative considered: string-only hostname deny lists. That is insufficient because public-looking hostnames can resolve to private addresses.

### Make side effects require policy plus request intent

The request body may still include `sendEmail`, `sendTelegram`, and `createPaymentLink`, but each action will be allowed only when the matching server-side policy flag is enabled. Disabled actions will be skipped with a clear reason rather than failing the whole run.

Alternative considered: trust OpenClaw skill instructions to keep side effects disabled. Skill instructions are useful UX guardrails, but the server must enforce the final safety boundary.

### Keep bearer token simple but strict

The API will continue to use a shared `Authorization: Bearer <token>` contract because OpenClaw Gateway only needs machine-to-machine access. The handler will treat missing server token configuration as unavailable and invalid caller tokens as unauthorized, using constant-time comparison where practical and never echoing token values.

Alternative considered: mTLS or Cloudflare Access service tokens for the MVP. Those are good later hardening layers, but a strong bearer token is enough for the first deployable contract when combined with Cloudflare controls and rate limits.

### Sanitize responses and logs at the boundary

The run API will return structured step results, but errors and logs must be sanitized for secrets before they leave the process. Token values, provider API keys, and authorization headers must not appear in JSON responses or logs.

Alternative considered: depend on individual provider clients not to include secrets in thrown errors. That is too brittle for a public API boundary.

## Risks / Trade-offs

- Cloudflare Rate Limiting API counters are location-local in some modes -> Use conservative limits and keep application-side fallback for local testing; consider Durable Objects if globally strict counters become necessary.
- DNS validation can have time-of-check/time-of-use gaps -> Validate before crawler invocation now; add redirect-target validation when crawler internals support it.
- Side-effect policy can block intended production actions if env is misconfigured -> Return explicit skipped reasons and document required policy flags.
- In-memory local rate limits reset on process restart -> Acceptable for local development; production must use Cloudflare rate limiting or an external/shared counter.
- Shared bearer tokens require rotation discipline -> Document token generation and allow replacement through environment variables without code changes.

## Migration Plan

1. Add security utilities for authorization comparison, URL validation, rate limiting, side-effect policy, and secret sanitization.
2. Apply the utilities to `POST /api/revenue-agent/run` before pipeline execution.
3. Add tests for unauthorized requests, malformed and unsafe URLs, rate-limit rejection, side-effect policy skips, and sanitized errors.
4. Update environment documentation for Cloudflare production deployment.
5. Deploy with all side-effect policy flags disabled by default, then enable individual actions only after manual verification.

Rollback is to redeploy the previous API version and keep OpenClaw Gateway pointing at the last known working `REVENUE_AGENT_BASE_URL`. Because this change is additive at the request contract level, OpenClaw does not need a skill change for rollback.

## Open Questions

- Should the first Cloudflare deployment use Workers Rate Limiting API directly in this app, a Cloudflare dashboard rate-limit rule, or both?
- Which side effects should be enabled first in production: Telegram internal notification only, or no side effects until full HIL is implemented?
- Should the API eventually require Cloudflare Access service credentials in addition to the bearer token?
