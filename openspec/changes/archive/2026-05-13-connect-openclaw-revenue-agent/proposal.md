## Why

OpenClaw can already host skills and route user requests from Telegram, while this repository can execute the RevenueAgentPlatform pipeline end-to-end. There is not yet a stable contract that lets OpenClaw invoke the pipeline as a single business action, so the two systems remain operationally separate.

## What Changes

- Introduce a RevenueAgentPlatform integration surface designed for OpenClaw skill invocation.
- Add a single high-level run contract that accepts a target URL and side-effect controls, then returns structured pipeline results.
- Keep the pipeline orchestration inside this repository so OpenClaw does not need to know step ordering, target state transitions, or provider-specific details.
- Document the corresponding OpenClaw skill contract and required environment configuration.
- Do not make webhook/payment completion production behavior part of this change.

## Capabilities

### New Capabilities
- `openclaw-revenue-agent-integration`: Defines how OpenClaw invokes the RevenueAgentPlatform pipeline, controls side effects, and receives structured results.

### Modified Capabilities
- `e2e-smoke-validation`: Reuse the validated smoke flow as the basis for the OpenClaw-facing run path while preserving smoke-specific behavior.

## Impact

- Affected code: pipeline orchestration entrypoints, HTTP/CLI integration surface, smoke harness reuse boundaries, docs.
- Affected external systems: OpenClaw Gateway skill definitions, Telegram, SendGrid, Stripe test/live configuration.
- New configuration likely required: shared integration token or local-only command boundary, OpenClaw-facing base URL, default side-effect policy.
- Security impact: OpenClaw-triggered runs must require explicit side-effect flags and must not expose secret values in responses or logs.
