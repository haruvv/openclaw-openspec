## 1. Shared Run Contract

- [ ] 1.1 Define request and response types for the OpenClaw-facing revenue-agent run.
- [ ] 1.2 Extract shared run logic from the smoke harness into a neutral module.
- [ ] 1.3 Update the existing smoke harness to call the neutral run module without changing smoke behavior.
- [ ] 1.4 Add unit tests for dry-run defaults, side-effect flags, and step result shaping.

## 2. HTTP Integration Endpoint

- [ ] 2.1 Add `REVENUE_AGENT_INTEGRATION_TOKEN` configuration and validation.
- [ ] 2.2 Add `POST /api/revenue-agent/run` with bearer-token authentication.
- [ ] 2.3 Validate request body URL and side-effect flags before running provider steps.
- [ ] 2.4 Return structured JSON results with sanitized errors and no secret values.
- [ ] 2.5 Add endpoint tests for unauthorized, invalid request, dry-run success, and side-effect flag propagation.

## 3. Documentation And OpenClaw Contract

- [ ] 3.1 Document the request/response contract and required environment variables.
- [ ] 3.2 Draft the `openclaw-gateway/skills/revenue-agent/SKILL.md` contract in docs or as a copied artifact.
- [ ] 3.3 Document local verification steps for OpenClaw calling the endpoint with side effects disabled.

## 4. Verification

- [ ] 4.1 Run `npm run build`.
- [ ] 4.2 Run `npm test`.
- [ ] 4.3 Run existing `npm run smoke:e2e -- https://example.com` to verify smoke compatibility.
- [ ] 4.4 Run the new HTTP endpoint locally with side effects disabled and inspect the JSON result.
