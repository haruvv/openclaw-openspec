## Context

The platform already performs deterministic SEO opportunity scoring from Firecrawl HTML, Lighthouse diagnostics, and local rules. Those findings are explainable and suitable as the factual basis for outreach, but they do not yet answer the sales questions that matter before contacting a company: whether the target is worth contacting, what offer is appropriate, how to phrase the first message politely, and what business impact to highlight.

The operating policy for this change is:

- Industries remain configurable from the admin UI; the system should not hard-code one first industry.
- The platform may recommend any monetizable homepage improvement service, but should prefer accessible low-friction offers at first.
- Pricing can use conservative AI-assisted market assumptions rather than premium agency pricing.
- Initial outreach must avoid insulting or overly direct sales language.
- Public email is the preferred first channel; inquiry forms may be supported as human-reviewed drafts, not fully automated form submission.
- Human review remains required before outreach.
- Small and medium businesses are the primary target profile.
- The first outreach goal is reply acquisition, not immediate payment.

## Goals / Non-Goals

**Goals:**

- Add an LLM-assisted audit layer that interprets deterministic SEO findings into sales priority, business impact, recommended offer, and outreach copy.
- Preserve deterministic scoring as the source of truth for factual claims, scores, and detected issues.
- Produce structured JSON that the admin UI can render and tests can validate.
- Make LLM failure non-fatal for the core crawl, scoring, and proposal pipeline.
- Support respectful public-email-first outreach that is reviewed by a human before sending.

**Non-Goals:**

- Do not replace Lighthouse SEO scoring or deterministic opportunity scoring with LLM scoring.
- Do not automatically submit inquiry forms.
- Do not remove HIL or allow unreviewed outbound outreach.
- Do not build reply inbox monitoring in this change.
- Do not implement per-industry pricing optimization beyond an initial generic price range model.

## Decisions

1. **Use deterministic findings as facts and LLM as sales interpretation**

   The LLM receives structured inputs such as URL, domain, industry hint, scores, diagnostics, opportunity findings, and available contact channel. It returns sales interpretation only. This avoids scoring drift and makes audit output easier to explain.

   Alternative considered: ask the LLM to rescore the website. Rejected because it would be less reproducible and could invent unsupported facts.

2. **Store the audit as `summary.llmRevenueAudit`**

   Run summary storage already carries structured JSON and is returned by the admin run detail API. Storing the first version there avoids a migration and keeps old runs compatible.

   Alternative considered: add a separate `revenue_audits` table. Deferred until search, aggregation, or audit version history becomes necessary.

3. **Validate LLM output with a strict schema**

   The LLM audit must be parsed as JSON and validated before persistence. Invalid output should mark the LLM step failed/skipped but should not fail the whole run if crawl and deterministic scoring succeeded.

   Alternative considered: store raw Markdown. Rejected because the UI needs structured sections and tests need stable behavior.

4. **Keep outreach policy explicit in prompt and schema**

   The LLM prompt should instruct the model to use a respectful free-diagnosis style, avoid direct criticism, target reply acquisition, and avoid claims of guaranteed revenue improvement. The schema should include caveats and confidence so the UI can show uncertainty.

5. **Render `営業評価` separately from `調査結果` and `営業提案書`**

   `調査結果` remains factual findings. `営業評価` is the LLM interpretation. `営業提案書` remains the longer proposal artifact. This keeps the mental model clear for human review.

## Risks / Trade-offs

- LLM may overstate business impact → constrain prompt, validate schema, include caveats, and render confidence.
- LLM may produce unusable JSON → fail only the LLM audit step and keep deterministic results available.
- Outreach copy may still feel too sales-heavy → encode the reply-acquisition-first policy and require human review before sending.
- Summary JSON can grow → keep the audit compact and defer separate storage until operational need appears.
- Generic price ranges may not fit all industries → start with conservative ranges and later make pricing configurable if needed.

## Migration Plan

- Deploy code that treats missing `summary.llmRevenueAudit` as absent data.
- New runs populate the audit when LLM credentials are available.
- Existing runs remain readable and show no `営業評価` section or an empty state.
- Rollback is safe because the new field is additive within JSON summary data.

## Open Questions

- Whether inquiry-form drafts should be generated in the first implementation or deferred until after public-email flow is validated.
- Whether pricing ranges should move to admin settings after the first operational trial.
