## Context

RevenueAgentPlatform executes a multi-step pipeline: crawl and score, LLM audit, proposal generation, and optional side-effecting providers. The run repository already persists step status, reason, error, duration, and JSON details, but many failures still collapse into terse text. Lighthouse is especially opaque because the runner returns `null` for timeout, process failure, or JSON parse failure, and the crawler previously could not tell operators which stage failed.

The system now continues when Lighthouse fails by using crawl-only fallback scoring. That avoids hard failures, but operators still need the run detail to show why Lighthouse was unavailable and whether the fallback was used.

## Goals / Non-Goals

**Goals:**

- Make Lighthouse failures diagnosable from persisted run details, not only container stdout.
- Increase Lighthouse timeout and make it configurable for Cloudflare Container execution.
- Preserve a structured diagnostic object for failed/skipped run steps.
- Keep diagnostics secret-safe and backward compatible with existing `reason`, `error`, and `details` fields.
- Add tests for timeout/process failure and fallback reporting.

**Non-Goals:**

- Replace Lighthouse with PageSpeed Insights in this change.
- Build a full observability pipeline, external log sink, or tracing backend.
- Change the admin UI visual design beyond data already available in run detail.
- Automatically retry provider calls in this change.

## Decisions

### Decision: Return structured Lighthouse measurements

`measureSeo` will return a discriminated result with either a Lighthouse result or a failure diagnostic. The crawler can then add a `lighthouse-unavailable` diagnostic with the failure reason and include a warning in crawl outputs.

Alternatives considered:

- Keep returning `null` and parse container logs: rejected because run details would still be opaque.
- Throw on Lighthouse failures: rejected because crawl-only fallback should keep the run usable.

### Decision: Keep step diagnostics inside existing `details`

Run step storage already supports JSON details. Failed/skipped diagnostics will be added under optional keys such as `failure` or `diagnostic` rather than adding a migration for new columns.

Alternatives considered:

- Add dedicated columns for error class and provider: rejected for now because details JSON is already persisted and avoids schema churn.
- Store only in logs: rejected because the admin run detail and D1 records need to be self-contained.

### Decision: Use a shared diagnostic shape

Diagnostics should include stable fields: `stage`, `reason`, `message`, `durationMs`, `retryable`, and optional provider-specific metadata such as exit code or stderr excerpt. Messages are sanitized before storage or logging.

Alternatives considered:

- Provider-specific ad hoc objects everywhere: rejected because it makes admin/debug tooling harder.
- Persist raw provider errors: rejected because they can contain secrets or noisy payloads.

### Decision: Classify fallback as warning, not failure

If crawling succeeds but Lighthouse fails, the crawl step can still pass. The run should record a warning and `lighthouseFallback=true` so the operator knows the SEO score came from fallback.

Alternatives considered:

- Fail the run whenever Lighthouse fails: rejected because it already blocked usable outreach analysis for reachable sites.
- Hide the fallback from run status/details: rejected because it obscures data quality.

## Risks / Trade-offs

- [Risk] Longer Lighthouse timeout increases run duration and container occupancy. -> Mitigation: make timeout configurable and default to a moderate production-friendly value.
- [Risk] Diagnostic excerpts could leak sensitive strings. -> Mitigation: sanitize messages and truncate stderr/stdout snippets before persistence.
- [Risk] More detailed failure objects may clutter step details. -> Mitigation: keep existing short `reason`/`error` fields and store structured diagnostics as optional details for debugging.
- [Risk] Some errors are hard to classify reliably. -> Mitigation: use broad categories such as `timeout`, `process_error`, `parse_error`, `provider_error`, and `unknown_error`.

## Migration Plan

1. Add shared diagnostic types and helper functions for sanitizing/classifying errors.
2. Update Lighthouse runner to return structured success/failure, configurable timeout, stderr excerpts, and Chrome flags.
3. Update crawler to record Lighthouse fallback warnings and skip details.
4. Update revenue-agent run step handling to persist failure diagnostics in `details` and log them with run context.
5. Update tests for crawler fallback, run step diagnostics, and smoke/report behavior.
6. Deploy without data migration because diagnostics are additive JSON fields.

Rollback: revert to shorter timeout and previous null-returning Lighthouse behavior if needed. Existing runs without diagnostic details remain readable.

## Open Questions

- Should repeated transient Lighthouse failures trigger an automatic retry before fallback?
- Should the admin UI add a dedicated warning block for provider fallbacks, or are step details enough for the first version?
