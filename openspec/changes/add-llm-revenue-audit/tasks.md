## 1. Data Model and Schema

- [x] 1.1 Define shared `LlmRevenueAudit` TypeScript types for summary persistence and admin UI rendering.
- [x] 1.2 Add a runtime validation schema for LLM audit JSON output.
- [x] 1.3 Add tests for valid audit output, invalid JSON, missing required fields, and unsupported enum values.

## 2. LLM Revenue Audit Module

- [x] 2.1 Create `src/revenue-audit` module structure with prompt/skill text, schema, and assessor entrypoint.
- [x] 2.2 Build the LLM input payload from deterministic crawl, Lighthouse, opportunity findings, industry hint, and contact-channel data.
- [x] 2.3 Implement JSON-only LLM invocation through the existing `llm-provider`.
- [x] 2.4 Ensure the assessor forbids score recalculation and unsupported factual claims in prompt instructions.
- [x] 2.5 Handle LLM, parsing, and validation failures as non-fatal audit errors.

## 3. Revenue Agent Integration

- [x] 3.1 Add an `llm_revenue_audit` run step after deterministic `crawl_and_score`.
- [x] 3.2 Persist successful audit output as `summary.llmRevenueAudit`.
- [x] 3.3 Record failed/skipped audit attempts without discarding deterministic research results or proposal artifacts.
- [x] 3.4 Include audit fields in run completion tests.

## 4. Proposal and Outreach Policy

- [x] 4.1 Update proposal generation to consume `llmRevenueAudit` when available.
- [x] 4.2 Update first-contact copy generation to use respectful, reply-acquisition-first language.
- [x] 4.3 Update outreach sender behavior/tests so email sending requires human approval.
- [x] 4.4 Add public-email-first handling and keep inquiry-form content as human-reviewed drafts only.

## 5. Admin UI

- [x] 5.1 Add admin UI parsing helpers for `summary.llmRevenueAudit`.
- [x] 5.2 Add `営業評価` section to run detail between `調査結果` and `営業提案書`.
- [x] 5.3 Render sales priority, confidence, business impact, recommended offer, outreach draft, and caveats.
- [x] 5.4 Add empty-state behavior for older runs without an LLM audit.
- [x] 5.5 Update admin UI tests for runs with and without `llmRevenueAudit`.

## 6. Verification and Documentation

- [x] 6.1 Update or add unit tests for revenue audit, runner integration, proposal generation, outreach policy, and admin UI rendering.
- [x] 6.2 Run `npm run lint`, `npm run build`, and `npm test`.
- [x] 6.3 Update operational documentation to explain rule-based research versus LLM営業評価 and the recommended initial outreach policy.
- [x] 6.4 Run production smoke test after deployment when implementation is complete.
