## Context

The application has independently tested modules, but no single executable path that verifies an environment can exercise the provider chain. Running the real pipeline directly would risk sending real outreach emails and creating unwanted payment links, so the smoke harness needs safe controls around side effects.

## Goals / Non-Goals

**Goals:**

- Provide `npm run smoke:e2e` as a local/operator command.
- Run a one-target validation with clear pass/fail/skip results per step.
- Avoid side effects by default for SendGrid/Slack/Stripe unless explicitly enabled.
- Save a JSON report that can be shared when diagnosing environment failures.
- Keep the harness testable without real external credentials.

**Non-Goals:**

- Replace full integration tests or provider-specific contract tests.
- Add a queue worker, scheduler, or inbound reply/analytics integration.
- Guarantee that every provider's production account configuration is correct.

## Decisions

### Use a dedicated smoke module

Create `src/smoke/e2e-smoke.ts` instead of reusing the MCP server. The smoke harness is an operator command with reporting and safety behavior; keeping it separate avoids changing the agent runtime contract.

### Use environment-driven safety gates

The harness will run read-only/generative steps when credentials exist. Side effects require explicit flags:

- `SMOKE_SEND_EMAIL=true` for SendGrid outreach email
- `SMOKE_SEND_SLACK=true` for Slack notifications
- `SMOKE_CREATE_STRIPE_LINK=true` for Stripe Payment Link creation

When a flag or credential is missing, the step is marked `skipped` with a reason.

### Save structured reports

Each run writes a JSON report to `output/smoke-runs/<timestamp>.json`, including target URL, step statuses, durations, skipped reasons, errors, and selected outputs such as proposal path or payment link URL.

## Risks / Trade-offs

- Real provider calls can still have side effects when explicitly enabled → default to skip side-effecting steps and make flags obvious in `.env.example`.
- Smoke tests can be flaky due to external services → report skipped/failed status precisely rather than hiding failures.
- Running Lighthouse can be slow locally → smoke command validates one URL only and uses existing crawler timeout behavior.
