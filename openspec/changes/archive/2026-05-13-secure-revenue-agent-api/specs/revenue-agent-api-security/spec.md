## ADDED Requirements

### Requirement: Revenue agent run API requires machine authentication
The system SHALL require `POST /api/revenue-agent/run` callers to provide a valid bearer token before request parsing or pipeline execution.

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

### Requirement: Revenue agent run API rate limits expensive work
The system SHALL apply rate limiting before executing crawler, LLM, email, notification, or payment-link work.

#### Scenario: Request is within the rate limit
- **WHEN** an authenticated request is within the configured rate limit window
- **THEN** the system continues to request validation and pipeline execution

#### Scenario: Request exceeds the rate limit
- **WHEN** an authenticated request exceeds the configured rate limit window
- **THEN** the system returns `429 Too Many Requests`
- **AND** no crawler, LLM, SendGrid, Telegram, or Stripe step is executed

#### Scenario: Cloudflare rate limit binding is unavailable in local development
- **WHEN** the system runs without a Cloudflare rate limit binding
- **THEN** the system uses a local fallback limiter with the same allow/deny behavior

### Requirement: Revenue agent run API rejects unsafe target URLs
The system SHALL validate the submitted `url` before passing it to any crawler or network-fetching component.

#### Scenario: URL uses unsupported scheme
- **WHEN** the request URL uses a scheme other than `http:` or `https:`
- **THEN** the system returns `400 Bad Request`
- **AND** no crawler, LLM, SendGrid, Telegram, or Stripe step is executed

#### Scenario: URL targets localhost or loopback
- **WHEN** the request URL hostname is `localhost` or resolves to a loopback address
- **THEN** the system returns `400 Bad Request`
- **AND** no crawler, LLM, SendGrid, Telegram, or Stripe step is executed

#### Scenario: URL targets private or link-local infrastructure
- **WHEN** the request URL host is a private, link-local, multicast, or cloud metadata address
- **THEN** the system returns `400 Bad Request`
- **AND** no crawler, LLM, SendGrid, Telegram, or Stripe step is executed

#### Scenario: URL resolves to a private address
- **WHEN** the request URL hostname resolves through DNS to a private, loopback, link-local, multicast, or metadata address
- **THEN** the system returns `400 Bad Request`
- **AND** no crawler, LLM, SendGrid, Telegram, or Stripe step is executed

### Requirement: Side effects require server-side policy approval
The system SHALL execute side-effecting revenue-agent steps only when both the request flag and the corresponding server-side policy flag allow the action.

#### Scenario: Caller requests email but policy disables email
- **WHEN** `sendEmail` is `true` and server-side email policy is disabled
- **THEN** the SendGrid step is marked `skipped`
- **AND** no email is sent

#### Scenario: Caller requests Telegram but policy disables Telegram
- **WHEN** `sendTelegram` is `true` and server-side Telegram policy is disabled
- **THEN** the Telegram step is marked `skipped`
- **AND** no Telegram message is sent

#### Scenario: Caller requests payment link but policy disables payment links
- **WHEN** `createPaymentLink` is `true` and server-side payment-link policy is disabled
- **THEN** the Stripe payment-link step is marked `skipped`
- **AND** no Stripe product, price, or Payment Link is created

#### Scenario: Caller and policy both allow a side effect
- **WHEN** a side-effect request flag is `true` and the matching server-side policy flag is enabled
- **THEN** the system may execute that side-effecting step if its provider credentials are configured

### Requirement: Revenue agent run API sanitizes secrets in responses and logs
The system SHALL prevent integration tokens and provider secrets from appearing in API responses or application logs.

#### Scenario: Provider error includes a secret-like value
- **WHEN** a provider error message contains a configured secret value or authorization header
- **THEN** the system records and returns a sanitized error message
- **AND** the raw secret value is not present in the response body

#### Scenario: Unauthorized request is logged
- **WHEN** an unauthorized request is rejected
- **THEN** the system logs the rejection without logging the bearer token value

### Requirement: Production deployment contract is explicit
The system SHALL document the environment variables and Cloudflare protection expected for production OpenClaw invocation.

#### Scenario: Operator configures production OpenClaw invocation
- **WHEN** an operator deploys RevenueAgentPlatform for OpenClaw production use
- **THEN** the documentation identifies `REVENUE_AGENT_BASE_URL`, `REVENUE_AGENT_INTEGRATION_TOKEN`, rate limit configuration, and side-effect policy flags

#### Scenario: Production side-effect policies are omitted
- **WHEN** side-effect policy flags are not configured
- **THEN** the system treats email, Telegram, and payment-link side effects as disabled by default
