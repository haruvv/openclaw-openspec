## MODIFIED Requirements

### Requirement: RevenueAgentPlatform has a production HTTPS endpoint
The system SHALL expose RevenueAgentPlatform through a stable HTTPS base URL suitable for OpenClaw Gateway production invocation and Cloudflare Access protection.

#### Scenario: Health check succeeds
- **WHEN** an operator calls `GET /health` on the production base URL
- **THEN** the system returns a successful health response

#### Scenario: Run endpoint is reachable
- **WHEN** an operator calls `POST /api/revenue-agent/run` on the production base URL with valid Cloudflare Access machine authentication, a valid bearer token, and a safe target URL
- **THEN** the system accepts the request and executes the side-effect-free run path

### Requirement: Cloudflare protects the production endpoint
The production endpoint SHALL be routed through Cloudflare for TLS, Cloudflare Access, rate limiting, and request filtering before reaching RevenueAgentPlatform.

#### Scenario: HTTP traffic reaches Cloudflare
- **WHEN** a request is made to the production RevenueAgentPlatform hostname
- **THEN** the request is served over HTTPS through Cloudflare

#### Scenario: Rate limit is configured
- **WHEN** production traffic targets `POST /api/revenue-agent/run`
- **THEN** Cloudflare rate limiting or an equivalent Cloudflare rule protects the endpoint from repeated expensive requests

#### Scenario: Admin access policy is configured
- **WHEN** production traffic targets `/admin`, `/admin/*`, `/api/admin`, or `/api/admin/*`
- **THEN** Cloudflare Access requires an allowed administrator identity before the request reaches admin functionality

#### Scenario: Machine access policy is configured
- **WHEN** production traffic targets `POST /api/revenue-agent/run`
- **THEN** Cloudflare Access requires an allowed Service Token or equivalent machine credential before the request reaches pipeline execution

## ADDED Requirements

### Requirement: Production Access Configuration Is Documented
The production deployment documentation SHALL identify the Cloudflare Access applications, policies, issuer, audience tags, and service-token credentials required for protected routes.

#### Scenario: Operator configures admin Access application
- **WHEN** an operator prepares production deployment
- **THEN** the documentation lists the admin paths protected by Cloudflare Access
- **AND** the documentation describes the required administrator allow policy and MFA expectation

#### Scenario: Operator configures machine Access application
- **WHEN** an operator prepares production OpenClaw invocation
- **THEN** the documentation lists the machine API path protected by Cloudflare Access
- **AND** the documentation describes the Access Service Token headers needed by automation

#### Scenario: Operator configures app-side JWT validation
- **WHEN** an operator enables production Access JWT validation
- **THEN** the documentation identifies the required issuer/team domain and application audience settings

### Requirement: Production Smoke Tests Cover Access Boundaries
The production smoke validation SHALL verify the new Cloudflare Access boundaries for admin and machine API routes.

#### Scenario: Unauthenticated admin smoke
- **WHEN** production smoke calls an admin API route without Cloudflare Access credentials
- **THEN** the request is denied by Cloudflare Access or app-side JWT validation

#### Scenario: Authenticated machine smoke
- **WHEN** production smoke calls `POST /api/revenue-agent/run` with valid Access Service Token credentials, a valid bearer token, and side effects disabled
- **THEN** the request reaches the side-effect-free run path

#### Scenario: Legacy token URL smoke is absent
- **WHEN** production smoke validates admin access
- **THEN** it does not use `?token=<ADMIN_TOKEN>` as the authorization mechanism
