## MODIFIED Requirements

### Requirement: Revenue agent run API requires machine authentication
The system SHALL require `POST /api/revenue-agent/run` callers to provide valid machine authentication before request parsing or pipeline execution. In production with Cloudflare Access enforcement enabled, machine authentication SHALL include a valid Cloudflare Access Service Token backed assertion and the existing valid bearer token during migration.

#### Scenario: Missing authorization header
- **WHEN** a request omits the `Authorization` header
- **THEN** the system returns `401 Unauthorized`
- **AND** no crawler, LLM, SendGrid, Telegram, or Stripe step is executed

#### Scenario: Invalid bearer token
- **WHEN** a request provides an incorrect bearer token
- **THEN** the system returns `401 Unauthorized`
- **AND** the response does not reveal whether the server-side token is configured

#### Scenario: Server token is not configured
- **WHEN** the server has no `REVENUE_AGENT_INTEGRATION_TOKEN`
- **THEN** the system returns `503 Service Unavailable`
- **AND** the response does not include any expected token value

#### Scenario: Missing Cloudflare Access service assertion
- **WHEN** production Cloudflare Access enforcement is enabled and a request omits a valid Access service assertion
- **THEN** the request is blocked by Cloudflare Access or rejected with `401 Unauthorized`
- **AND** no crawler, LLM, SendGrid, Telegram, or Stripe step is executed

#### Scenario: Invalid Cloudflare Access service assertion
- **WHEN** production Cloudflare Access enforcement is enabled and a request includes a forged, expired, or wrong-audience Access assertion
- **THEN** the system returns `401 Unauthorized`
- **AND** no crawler, LLM, SendGrid, Telegram, or Stripe step is executed

#### Scenario: Valid service assertion and bearer token
- **WHEN** production Cloudflare Access enforcement is enabled and a request includes both a valid Access service assertion and a valid bearer token
- **THEN** the system continues to request validation and pipeline execution

#### Scenario: Local machine API request
- **WHEN** the system runs outside production without Cloudflare Access enforcement
- **THEN** the existing valid bearer token is sufficient for machine API authentication

## ADDED Requirements

### Requirement: Machine Access JWTs Identify Service Credentials
The system SHALL distinguish Cloudflare Access service-token authenticated requests from human Access sessions for machine API routes.

#### Scenario: Service token authenticated request
- **WHEN** `POST /api/revenue-agent/run` includes a valid Cloudflare Access JWT produced from a Service Token
- **THEN** the system treats the request as machine-authenticated for the revenue-agent run API

#### Scenario: Human session calls machine API
- **WHEN** `POST /api/revenue-agent/run` includes a valid human administrator Access JWT but not a configured machine service credential assertion
- **THEN** the system rejects the request unless an explicit migration setting allows human Access sessions for that API
