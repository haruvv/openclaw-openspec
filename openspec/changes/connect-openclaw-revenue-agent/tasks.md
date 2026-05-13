## 1. Shared Run Contract

- [x] 1.1 Define request and response types for the OpenClaw-facing revenue-agent run.
- [x] 1.2 Extract shared run logic from the smoke harness into a neutral module.
- [x] 1.3 Update the existing smoke harness to call the neutral run module without changing smoke behavior.
- [x] 1.4 Add unit tests for dry-run defaults, side-effect flags, and step result shaping.

## 2. HTTP Integration Endpoint

- [x] 2.1 Add `REVENUE_AGENT_INTEGRATION_TOKEN` configuration and validation.
- [x] 2.2 Add `POST /api/revenue-agent/run` with bearer-token authentication.
- [x] 2.3 Validate request body URL and side-effect flags before running provider steps.
- [x] 2.4 Return structured JSON results with sanitized errors and no secret values.
- [x] 2.5 Add endpoint tests for unauthorized, invalid request, dry-run success, and side-effect flag propagation.

## 3. Documentation And OpenClaw Contract

- [x] 3.1 Document the request/response contract and required environment variables.
- [x] 3.2 Draft the `openclaw-gateway/skills/revenue-agent/SKILL.md` contract in docs or as a copied artifact.
- [x] 3.3 Document local verification steps for OpenClaw calling the endpoint with side effects disabled.

## 4. Verification

- [x] 4.1 Run `npm run build`.
- [x] 4.2 Run `npm test`.
- [x] 4.3 Run existing `npm run smoke:e2e -- https://example.com` to verify smoke compatibility.
- [x] 4.4 Run the new HTTP endpoint locally with side effects disabled and inspect the JSON result.
