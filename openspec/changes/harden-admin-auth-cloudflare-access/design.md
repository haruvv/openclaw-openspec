## Context

RevenueAgentPlatform is deployed on Cloudflare Workers and Containers. The current admin boundary uses `ADMIN_TOKEN`: server-rendered admin routes accept `?token=...`, set an `admin_token` cookie, and the React admin UI stores the token in `sessionStorage` so `/api/admin/*` calls can append it as a query parameter. Worker Static Assets now serve the admin SPA shell before Container routing, so page-shell access and API access already have different enforcement points.

The expensive machine API, `POST /api/revenue-agent/run`, is protected by `REVENUE_AGENT_INTEGRATION_TOKEN` and a Worker rate-limit binding. That API is intended for OpenClaw or automation, not browser administrators.

Cloudflare Access fits the deployment shape: human admin requests can be gated by identity provider policies and MFA, while automation can use Access Service Tokens. The app should still validate Cloudflare Access assertions because the Worker hostname may remain reachable through Cloudflare routes and because trusting the mere presence of Access headers is not sufficient.

## Goals / Non-Goals

**Goals:**
- Make Cloudflare Access the production access boundary for `/admin`, `/admin/*`, `/api/admin`, and `/api/admin/*`.
- Remove production dependence on `ADMIN_TOKEN` query strings and client-side token propagation.
- Validate `Cf-Access-Jwt-Assertion` in application code using Cloudflare Access issuer, audience, and signing keys.
- Support Cloudflare Access Service Token authenticated machine requests for `POST /api/revenue-agent/run`.
- Preserve local development ergonomics and provide a staged migration path that can roll back to the current bearer-token behavior.
- Update production setup and smoke documentation so operators can configure and verify the new boundary.

**Non-Goals:**
- Building first-party username/password auth, user management, RBAC, or an admin user database.
- Replacing external provider authorization such as Telegram webhook secrets or Stripe webhook signatures.
- Removing `REVENUE_AGENT_INTEGRATION_TOKEN` immediately from the machine API.
- Managing Cloudflare Access applications through repository-owned Terraform in the first implementation.

## Decisions

### 1. Use Cloudflare Access as the primary admin authentication layer

Production admin access will be controlled by a Cloudflare Access self-hosted application covering `/admin`, `/admin/*`, `/api/admin`, and `/api/admin/*` on the production hostname. The Access policy will allow only configured administrator identities and require MFA through the identity provider or Cloudflare Access policy.

Rationale: Access gives identity, session expiry, MFA, revocation, and auditability without adding an auth database to this app. It also blocks unauthenticated requests before the Container handles admin API work.

Alternatives considered:
- Keep `ADMIN_TOKEN` and make it longer: simpler but still bearer-secret sharing with weak auditability and query-string leakage risk.
- Implement OAuth in Express: more code and more operational surface than needed while Cloudflare already fronts production traffic.

### 2. Validate Access JWTs in the app for protected production routes

The Worker/Container will validate the `Cf-Access-Jwt-Assertion` header when Access enforcement is enabled. Validation will verify the JWT signature using Cloudflare Access JWKs, issuer, audience, expiry, and token type. Configuration will be explicit through environment variables such as the Access issuer/team domain and application audience tag. The validation helper should cache JWKs to avoid per-request key fetches.

Rationale: Cloudflare documentation recommends validating the Access JWT instead of trusting headers or cookies alone. App-side validation also provides defense against accidental route exposure, misrouted traffic, and header spoofing.

Alternatives considered:
- Trust Cloudflare Access without app validation: operationally common but weaker if a route bypass or direct Worker URL remains available.
- Validate only `CF_Authorization` cookies: less reliable for API calls because the header assertion is the stable origin-facing token.

### 3. Phase out `ADMIN_TOKEN` for production admin UI/API access

The admin UI will stop reading `token` from the URL and stop appending `token` to `/api/admin/*` calls in production. Server-side admin helpers will treat a valid Access JWT as sufficient admin authorization. `ADMIN_TOKEN` can remain as a local development fallback and, optionally, a temporary emergency fallback behind an explicit environment flag during rollout.

Rationale: Query tokens are easy to leak and hard to audit. Keeping a local fallback avoids slowing development and tests.

Alternatives considered:
- Replace query token with an HTTP-only login cookie: better than query strings but still a shared secret with no identity or MFA.
- Remove all non-Access fallbacks immediately: cleaner but makes local development and rollback unnecessarily brittle.

### 4. Use Access Service Tokens for machine callers, with existing bearer token retained during migration

Cloudflare Access Service Tokens will be configured for automation that calls `POST /api/revenue-agent/run`. During migration, the request must satisfy Access Service Auth at the Cloudflare layer and the existing `Authorization: Bearer <REVENUE_AGENT_INTEGRATION_TOKEN>` check in application code. The app-side JWT validation will identify service-token claims separately from human admin claims.

Rationale: Access Service Tokens are revocable per client and visible in Cloudflare logs, while the existing bearer token is already wired through OpenClaw and tests. Requiring both during migration reduces risk from either token being exposed alone.

Alternatives considered:
- Replace `REVENUE_AGENT_INTEGRATION_TOKEN` immediately: simpler long term but creates more coordination risk with OpenClaw.
- Use only the existing bearer token: leaves the public endpoint dependent on one shared secret.

### 5. Prefer route separation by hostname or Access application path

If feasible, production should use a stable custom hostname controlled by Cloudflare rather than relying on `workers.dev`. Access policies should cover only sensitive paths, leaving public webhooks and public success pages reachable as required. `/telegram/webhook`, `/webhooks/stripe`, `/hil/*`, `/thank-you`, and `/health` need explicit treatment so Access does not block provider callbacks or health checks unintentionally.

Rationale: The current Worker serves a mixture of admin UI, machine APIs, webhooks, health, and public pages. A path-scoped Access policy avoids breaking public integrations while still protecting the sensitive surfaces.

Alternatives considered:
- Protect the whole hostname with Access: strongest default, but risks breaking Stripe/Telegram callbacks and public HIL/thank-you flows unless bypass policies are carefully maintained.
- Move admin to a separate hostname now: cleanest boundary, but requires DNS and deployment work beyond the first hardening pass.

## Risks / Trade-offs

- Access policy path mismatch could leave an admin route unprotected or block a public callback. -> Add route inventory, docs, and smoke checks for protected and intentionally public paths.
- Access JWT validation can fail after Cloudflare signing key rotation if keys are hard-coded. -> Fetch JWKs from the Access certs endpoint and cache by `kid` with refresh on unknown key.
- Service Token rollout can break OpenClaw if headers are not coordinated. -> Keep the existing bearer token during migration and document the required Access headers separately.
- Static admin assets are served at the Worker before the Container. -> Enforce Access at Cloudflare for the full admin path and add Worker-level validation where sensitive API forwarding occurs.
- Local tests may become harder if every admin request needs a signed JWT. -> Keep a test/local bypass path controlled by `NODE_ENV !== "production"` and targeted helper injection.

## Migration Plan

1. Create Cloudflare Access applications/policies for admin paths and machine API paths on the production hostname.
2. Add environment configuration for Access issuer, audience tags, and enforcement mode.
3. Implement and test Access JWT validation helpers.
4. Update admin route/API authorization to accept valid Access identity and remove production query-token dependence.
5. Update admin UI to stop reading or appending `token` in production.
6. Configure Access Service Token credentials for OpenClaw/automation and update smoke tests to send them.
7. Deploy with `REVENUE_AGENT_INTEGRATION_TOKEN` still required for machine API calls.
8. Verify unauthenticated admin/API requests fail at Access or app validation, authenticated admin requests succeed, public callbacks remain reachable, and machine API smoke succeeds.
9. Remove old production documentation that instructs operators to open `?token=<ADMIN_TOKEN>` URLs.

Rollback: disable Access enforcement mode in app configuration and restore the previous `ADMIN_TOKEN`/bearer-token smoke inputs, while leaving Cloudflare Access policies available for re-enable after correction.

## Open Questions

- Which production hostname will be canonical for Access: the existing Workers hostname or a custom Cloudflare-managed domain?
- Which identity provider and allow list should be used for human admins?
- Should `/health` remain public, be protected by Access, or return only non-sensitive status publicly?
- After migration proves stable, should `REVENUE_AGENT_INTEGRATION_TOKEN` be removed from machine API auth or retained permanently as defense in depth?
