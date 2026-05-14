## ADDED Requirements

### Requirement: Production deployment applies secured API configuration
The production RevenueAgentPlatform deployment SHALL configure the secured API controls required by `revenue-agent-api-security`.

#### Scenario: Production security environment is configured
- **WHEN** RevenueAgentPlatform is deployed for production OpenClaw invocation
- **THEN** the deployment config includes `REVENUE_AGENT_INTEGRATION_TOKEN`, `REVENUE_AGENT_RATE_LIMIT_PER_MINUTE`, and default-disabled `REVENUE_AGENT_ALLOW_*` policy flags

#### Scenario: Production side-effect policies are omitted
- **WHEN** production side-effect policy flags are not explicitly configured
- **THEN** the deployment treats email, Telegram, and payment-link side effects as disabled
