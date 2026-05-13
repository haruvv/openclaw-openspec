## Context

RevenueAgentPlatform currently has working internal pipeline pieces and a validated E2E smoke harness. OpenClaw Gateway already supports skill definitions under `openclaw-gateway/skills`, but this repository does not expose a stable, OpenClaw-oriented business action.

The desired integration is not "make OpenClaw orchestrate every pipeline step." OpenClaw should invoke one high-level revenue-agent action and receive a concise structured result. This repository remains responsible for crawl/evaluation/proposal/payment/email/notification ordering and provider behavior.

The current local execution path is `runE2eSmoke()`, which is useful for validation but named and shaped as a smoke test. The integration needs a production-ish run surface that can reuse the same proven steps without coupling OpenClaw to smoke terminology.

## Goals / Non-Goals

**Goals:**

- Provide a single OpenClaw-facing action for running RevenueAgentPlatform against a URL.
- Support explicit side-effect controls for email, Telegram, and Stripe Payment Link creation.
- Return structured JSON that OpenClaw can summarize in Telegram.
- Keep provider secrets inside RevenueAgentPlatform/OpenClaw environment configuration and out of responses.
- Document the matching `openclaw-gateway` skill contract.
- Preserve the existing smoke harness and tests.

**Non-Goals:**

- Do not implement Stripe webhook payment-completion automation in this change.
- Do not require OpenClaw to call individual crawl/proposal/payment primitives.
- Do not deploy the service to production in this change.
- Do not move this repository into the OpenClaw monorepo.

## Decisions

### Decision: Expose one high-level run action first

OpenClaw will get one user-facing skill action: run the revenue-agent pipeline for a URL. Internally, this repository can keep separate services for crawl, score, proposal generation, notifications, and payments.

Rationale: OpenClaw should not need to know step ordering, target state transitions, provider fallback behavior, or which failures are recoverable. If individual primitives are needed later, they can be promoted after the first integration proves real usage.

Alternative considered: expose each primitive as an OpenClaw skill. This increases flexibility but moves orchestration complexity into OpenClaw and makes conversation-level retries harder to reason about.

### Decision: Add a stable HTTP API before deeper production infrastructure

The first integration surface should be an HTTP endpoint in this repository, such as `POST /api/revenue-agent/run`, guarded by a bearer token. OpenClaw Gateway can call that endpoint from a skill using `curl` or fetch-like tooling.

Rationale: `openclaw-gateway` runs in a Cloudflare Sandbox/Worker setup. Installing and maintaining this full Node pipeline inside that container is more brittle than calling a service boundary. HTTP also matches future deployment needs.

Alternative considered: expose only a CLI. CLI is useful locally, but Cloudflare Sandbox packaging and file-system assumptions make it a weaker first production path.

### Decision: Reuse smoke run semantics but rename the integration layer

The integration implementation should reuse the tested smoke steps where practical, but the public API should be named around revenue-agent execution, not smoke validation.

Rationale: smoke tests already validate the exact external services we need. Reusing them reduces risk, while a separate API shape avoids leaking test vocabulary into OpenClaw.

### Decision: Side effects are opt-in per request

The run request must include explicit booleans for side-effecting steps:

- `sendEmail`
- `sendTelegram`
- `createPaymentLink`

The default behavior must be dry-run style: crawl, score, and generate proposal only.

Rationale: OpenClaw's design classifies external API cost and customer-facing actions as higher-risk operations. The integration should make side effects visible and explicit at the boundary.

### Decision: OpenClaw skill lives in `openclaw-gateway`, contract lives here

This repository should define and document the API contract. The actual skill file belongs in `openclaw-gateway/skills/revenue-agent/SKILL.md`.

Rationale: `agent-dev-studio` is a design workspace, `openclaw-gateway` is the runtime host, and this repository owns the pipeline. Keeping those roles distinct avoids repo coupling.

## Risks / Trade-offs

- API endpoint becomes a thin duplicate of smoke harness → Mitigation: factor shared run logic into a neutral module and keep smoke as a caller.
- Long-running LLM calls exceed OpenClaw request expectations → Mitigation: start synchronous for MVP, then add job-based async execution if real calls are too slow.
- Side effects accidentally run from casual chat requests → Mitigation: default all side effects to false and require OpenClaw skill text to confirm L3 actions before enabling them.
- Secrets leak through structured responses → Mitigation: only return IDs, URLs intended for users, paths, statuses, and sanitized errors.
- OpenClaw and this repo drift on request/response shape → Mitigation: keep the API contract in OpenSpec and mirror it in `docs/` when implemented.

## Migration Plan

1. Add a neutral run module and HTTP endpoint in this repository.
2. Keep existing smoke command working by calling the neutral run module.
3. Add docs showing local OpenClaw integration and environment variables.
4. Add `openclaw-gateway` skill in the OpenClaw repo after this API is stable.
5. Run local endpoint smoke, then OpenClaw-to-endpoint test with side effects disabled.

Rollback: remove the new endpoint/skill without changing the existing smoke harness or pipeline internals.
