## 1. Deployment Target

- [x] 1.1 Choose Cloudflare Containers or Cloudflare Tunnel plus a Node host for RevenueAgentPlatform production.
- [x] 1.2 Add the deployment configuration needed for the chosen hosting target.
- [x] 1.3 Configure the production hostname and Cloudflare route.

## 2. Production Configuration

- [x] 2.1 Configure RevenueAgentPlatform production secrets and environment variables.
- [x] 2.2 Configure Cloudflare rate limiting for `POST /api/revenue-agent/run`.
- [x] 2.3 Keep `REVENUE_AGENT_ALLOW_EMAIL`, `REVENUE_AGENT_ALLOW_TELEGRAM`, and `REVENUE_AGENT_ALLOW_PAYMENT_LINK` disabled for first deployment.
- [ ] 2.4 Configure OpenClaw Gateway production `REVENUE_AGENT_BASE_URL` and matching integration token.

## 3. Verification

- [ ] 3.1 Verify production `GET /health`.
- [ ] 3.2 Verify direct production `POST /api/revenue-agent/run` with side effects disabled.
- [ ] 3.3 Verify OpenClaw Gateway can invoke the production RevenueAgentPlatform API.
- [x] 3.4 Document rollback steps and the previous known-good base URL.

## 4. Final Checks

- [x] 4.1 Run relevant tests and type checks after deployment config changes.
- [x] 4.2 Run `openspec validate deploy-revenue-agent-platform --strict`.
