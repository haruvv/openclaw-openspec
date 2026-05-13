## ADDED Requirements

### Requirement: OpenClaw Gateway can target production RevenueAgentPlatform
OpenClaw Gateway production configuration SHALL point the revenue-agent skill at the deployed RevenueAgentPlatform base URL with the matching integration token.

#### Scenario: Gateway production env is configured
- **WHEN** OpenClaw Gateway is deployed for production RevenueAgentPlatform invocation
- **THEN** `REVENUE_AGENT_BASE_URL` is set to the production HTTPS base URL
- **AND** `REVENUE_AGENT_INTEGRATION_TOKEN` matches the RevenueAgentPlatform production token

#### Scenario: Gateway invokes production in dry-run mode
- **WHEN** OpenClaw Gateway invokes the revenue-agent skill against production with side effects disabled
- **THEN** RevenueAgentPlatform returns a structured run result that OpenClaw can summarize
