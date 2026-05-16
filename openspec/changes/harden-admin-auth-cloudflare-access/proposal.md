## Why

The admin portal and admin APIs are currently protected primarily by a shared `ADMIN_TOKEN`, including URL query-token flows that can leak through browser history, logs, and referrers. Since the production deployment already runs behind Cloudflare, Cloudflare Access can provide a stronger identity boundary for human administrators and revocable service credentials for machine callers before requests reach the Worker or Container.

## What Changes

- Protect human-facing admin surfaces with Cloudflare Access identity policies instead of relying on `ADMIN_TOKEN` URLs.
- Remove production use of `?token=<ADMIN_TOKEN>` and browser sessionStorage token propagation for admin UI/API access.
- Add application-side validation for Cloudflare Access JWT assertions so the app can reject spoofed or bypassed requests.
- Allow machine callers to use Cloudflare Access Service Tokens for protected revenue-agent API access, while preserving the existing bearer token during migration as a defense-in-depth check.
- Update deployment and operations documentation for Access applications, policies, service tokens, JWT validation settings, and smoke-test credentials.
- **BREAKING**: Production admin URLs will no longer accept `ADMIN_TOKEN` query parameters as the primary access mechanism after migration.

## Capabilities

### New Capabilities
- `admin-access-security`: Defines Cloudflare Access based authentication and authorization for `/admin`, `/admin/*`, `/api/admin`, and `/api/admin/*`.

### Modified Capabilities
- `revenue-agent-api-security`: Machine API authentication will support Cloudflare Access Service Token backed requests in addition to the existing bearer-token boundary during migration.
- `revenue-agent-platform-deployment`: Production deployment requirements will include Cloudflare Access application/policy configuration, Access JWT validation settings, and updated admin/API smoke checks.

## Impact

- Affected code: Worker request handling, admin route authentication helpers, admin UI API client token handling, revenue-agent API auth helpers, tests.
- Affected APIs: `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*`, and `POST /api/revenue-agent/run`.
- Affected configuration: Cloudflare Zero Trust Access applications/policies, service tokens, optional Access JWT validation environment variables, production secrets, smoke-test secrets.
- Affected docs: deployment guide, operations guide, integration instructions, and any examples that currently show `?token=<ADMIN_TOKEN>`.
