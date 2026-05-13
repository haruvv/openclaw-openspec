## ADDED Requirements

### Requirement: RevenueAgentPlatform has a production HTTPS endpoint
The system SHALL expose RevenueAgentPlatform through a stable HTTPS base URL suitable for OpenClaw Gateway production invocation.

#### Scenario: Health check succeeds
- **WHEN** an operator calls `GET /health` on the production base URL
- **THEN** the system returns a successful health response

#### Scenario: Run endpoint is reachable
- **WHEN** an operator calls `POST /api/revenue-agent/run` on the production base URL with a valid bearer token and safe target URL
- **THEN** the system accepts the request and executes the side-effect-free run path

### Requirement: Cloudflare protects the production endpoint
The production endpoint SHALL be routed through Cloudflare for TLS, rate limiting, and request filtering before reaching RevenueAgentPlatform.

#### Scenario: HTTP traffic reaches Cloudflare
- **WHEN** a request is made to the production RevenueAgentPlatform hostname
- **THEN** the request is served over HTTPS through Cloudflare

#### Scenario: Rate limit is configured
- **WHEN** production traffic targets `POST /api/revenue-agent/run`
- **THEN** Cloudflare rate limiting or an equivalent Cloudflare rule protects the endpoint from repeated expensive requests

### Requirement: Production secrets are environment-managed
The deployment SHALL configure all RevenueAgentPlatform credentials through production secrets or environment variables, not committed files.

#### Scenario: Required API token is configured
- **WHEN** RevenueAgentPlatform starts in production
- **THEN** `REVENUE_AGENT_INTEGRATION_TOKEN` is available to the process

#### Scenario: Secret values are absent from repository files
- **WHEN** the deployment configuration is reviewed
- **THEN** provider API keys, integration tokens, and webhook secrets are not committed to the repository

### Requirement: First production verification is side-effect-free
The first production deployment SHALL verify the run API with email, Telegram, and Stripe side effects disabled.

#### Scenario: Side-effect-free verification request
- **WHEN** the operator verifies production with `sendEmail=false`, `sendTelegram=false`, and `createPaymentLink=false`
- **THEN** the system crawls, scores, and generates a proposal when providers are available
- **AND** email, Telegram, and Stripe steps are skipped

#### Scenario: Server-side side-effect policies remain disabled
- **WHEN** the first production deployment is configured
- **THEN** `REVENUE_AGENT_ALLOW_EMAIL`, `REVENUE_AGENT_ALLOW_TELEGRAM`, and `REVENUE_AGENT_ALLOW_PAYMENT_LINK` are set to `false` or omitted

### Requirement: Production rollback is documented
The deployment SHALL include rollback instructions that restore the previous known-good RevenueAgentPlatform API target.

#### Scenario: Deployment verification fails
- **WHEN** production verification fails after deployment
- **THEN** the operator can restore the previous service version or point OpenClaw Gateway back to the previous known-good `REVENUE_AGENT_BASE_URL`
