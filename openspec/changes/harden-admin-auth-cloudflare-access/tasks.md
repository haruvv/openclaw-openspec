## 1. Cloudflare Access Configuration Contract

- [x] 1.1 Decide and document the canonical production hostname and protected path inventory for admin, machine API, public callbacks, HIL routes, thank-you page, and health checks.
- [x] 1.2 Define required Cloudflare Access admin application settings, including protected paths, allowed administrator identities, session duration, and MFA expectation.
- [x] 1.3 Define required Cloudflare Access machine application or policy settings for `POST /api/revenue-agent/run`, including Service Token creation, rotation, and revocation notes.
- [x] 1.4 Add production environment variable documentation for Access issuer/team domain, admin audience tag, machine audience tag, and Access enforcement mode.

## 2. Access JWT Validation

- [x] 2.1 Add a shared Cloudflare Access JWT validation module that reads `Cf-Access-Jwt-Assertion`, verifies issuer, audience, expiry, token type, and RS256 signature against Access JWKs.
- [x] 2.2 Cache Access JWKs by `kid` and refresh on cache miss or signature-key rotation without hard-coding public keys.
- [x] 2.3 Add tests for valid JWTs, invalid signatures, wrong audience, expired tokens, missing headers, and signing-key refresh behavior.
- [x] 2.4 Add secret-safe logging for Access authorization failures without logging JWT contents.

## 3. Admin UI And Admin API Authorization

- [x] 3.1 Update admin page and admin API authorization helpers to accept valid Cloudflare Access admin JWTs in production.
- [x] 3.2 Restrict `ADMIN_TOKEN` query/cookie authorization to local development or an explicit temporary fallback flag.
- [x] 3.3 Update Worker admin asset handling so admin page-shell requests are covered by the Access boundary and do not expose protected admin data without valid Access identity.
- [x] 3.4 Remove production admin UI logic that stores `token` from URLs or appends `token` to `/api/admin/*` requests.
- [x] 3.5 Update admin route and UI tests for Access-authenticated success, unauthenticated failure, no query-token propagation, and local fallback behavior.

## 4. Machine API Service Token Support

- [x] 4.1 Update revenue-agent run API authorization to require valid Cloudflare Access machine authentication when Access enforcement is enabled.
- [x] 4.2 Preserve `REVENUE_AGENT_INTEGRATION_TOKEN` validation during migration and ensure both Access service auth and bearer auth are required in production enforcement mode.
- [x] 4.3 Reject human Access sessions on `POST /api/revenue-agent/run` unless an explicit migration flag allows them.
- [x] 4.4 Add route tests covering missing Access assertion, invalid Access assertion, valid service-token assertion plus invalid bearer token, and valid service-token assertion plus valid bearer token.

## 5. Deployment, Smoke, And Operations

- [x] 5.1 Update deployment documentation to remove `?token=<ADMIN_TOKEN>` production admin examples and replace them with Cloudflare Access login instructions.
- [x] 5.2 Update OpenClaw integration and operations docs with Access Service Token header requirements and token rotation/revocation guidance.
- [x] 5.3 Update production smoke tests to verify unauthenticated admin/API denial without query tokens.
- [x] 5.4 Update production smoke tests to support Access Service Token credentials for side-effect-free `POST /api/revenue-agent/run`.
- [x] 5.5 Document rollback steps that disable app-side Access enforcement while preserving existing bearer-token behavior.

## 6. Verification

- [x] 6.1 Run the unit test suite for admin auth, worker routes, revenue-agent auth, and production smoke helper changes.
- [x] 6.2 Run typecheck/build for server, worker, and admin UI changes.
- [x] 6.3 Run OpenSpec validation for `harden-admin-auth-cloudflare-access`.
- [x] 6.4 Record manual Cloudflare dashboard setup steps that cannot be validated locally.
