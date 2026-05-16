## ADDED Requirements

### Requirement: Admin Routes Require Cloudflare Access Identity
The system SHALL require a valid Cloudflare Access application JWT for production requests to `/admin`, `/admin/*`, `/api/admin`, and `/api/admin/*`.

#### Scenario: Authenticated admin opens portal
- **WHEN** a production request opens `/admin` with a valid Cloudflare Access JWT for an allowed administrator
- **THEN** the system serves the admin portal
- **AND** the response does not require an `ADMIN_TOKEN` query parameter

#### Scenario: Unauthenticated admin portal request
- **WHEN** a production request opens `/admin` without a valid Cloudflare Access JWT
- **THEN** the system denies access through Cloudflare Access or returns an unauthorized response before showing admin data

#### Scenario: Authenticated admin API request
- **WHEN** a production request calls `/api/admin/*` with a valid Cloudflare Access JWT for an allowed administrator
- **THEN** the system processes the admin API request

#### Scenario: Unauthenticated admin API request
- **WHEN** a production request calls `/api/admin/*` without a valid Cloudflare Access JWT
- **THEN** the system returns `401 Unauthorized` or is blocked by Cloudflare Access
- **AND** no admin data is returned

### Requirement: Admin Access JWTs Are Validated Server-side
The system SHALL validate Cloudflare Access JWT assertions for protected admin requests using configured issuer, audience, expiry, and signing keys.

#### Scenario: Access JWT has invalid signature
- **WHEN** a protected admin request includes a `Cf-Access-Jwt-Assertion` value with an invalid signature
- **THEN** the system rejects the request as unauthorized

#### Scenario: Access JWT has wrong audience
- **WHEN** a protected admin request includes a validly signed Cloudflare Access JWT for a different application audience
- **THEN** the system rejects the request as unauthorized

#### Scenario: Access JWT is expired
- **WHEN** a protected admin request includes an expired Cloudflare Access JWT
- **THEN** the system rejects the request as unauthorized

#### Scenario: Access signing key rotates
- **WHEN** Cloudflare Access rotates signing keys and a protected request presents a token signed by the new key
- **THEN** the system can refresh or use the configured Access JWK set to validate the token

### Requirement: Admin Token Query Flow Is Not Used In Production
The system SHALL NOT rely on `ADMIN_TOKEN` query parameters or browser sessionStorage token propagation for production admin access.

#### Scenario: Production admin URL contains token query
- **WHEN** a production request opens `/admin?token=<value>`
- **THEN** the system does not treat the query parameter as the primary authorization proof
- **AND** access still requires a valid Cloudflare Access identity

#### Scenario: Admin UI calls admin API
- **WHEN** the production admin UI calls `/api/admin/*`
- **THEN** the request uses same-origin credentials provided by Cloudflare Access
- **AND** the UI does not append `token` to the API URL

#### Scenario: Local development uses admin fallback
- **WHEN** the app runs outside production without Cloudflare Access configuration
- **THEN** local admin access can use the existing development fallback behavior

### Requirement: Public And Callback Routes Remain Intentionally Reachable
The system SHALL keep non-admin public and provider callback routes outside the admin Access policy unless a route has a separate authentication contract.

#### Scenario: Stripe webhook reaches application
- **WHEN** Stripe sends a request to `/webhooks/stripe`
- **THEN** Cloudflare Access admin policy does not block the request
- **AND** Stripe webhook signature validation remains responsible for authorization

#### Scenario: Telegram webhook reaches application
- **WHEN** Telegram sends a request to `/telegram/webhook`
- **THEN** Cloudflare Access admin policy does not block the request
- **AND** the Telegram webhook secret remains responsible for authorization when configured

#### Scenario: Admin route inventory is reviewed
- **WHEN** production protected routes are configured
- **THEN** `/admin`, `/admin/*`, `/api/admin`, and `/api/admin/*` are listed as protected
- **AND** public routes such as `/health`, `/hil/*`, `/thank-you`, `/telegram/webhook`, and `/webhooks/stripe` are explicitly documented as protected or intentionally public
