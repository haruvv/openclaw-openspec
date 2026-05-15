## Why

The current SEO opportunity scoring is deterministic and explainable, but it does not yet translate findings into the sales judgment needed for homepage improvement outreach. To earn revenue from small and medium businesses, the platform needs an LLM-assisted revenue audit that keeps rule-based facts intact while producing respectful outreach angles, recommended offers, and human-reviewable contact drafts.

## What Changes

- Add an LLM revenue audit step that enriches rule-based SEO opportunity findings with business impact, sales priority, recommended offer, and outreach angle.
- Keep Lighthouse SEO score and deterministic opportunity scoring as the source of truth for facts and scores; the LLM must not recalculate scores or invent unsupported company facts.
- Store the structured LLM audit result on the run summary so the admin UI can show it alongside the existing research results.
- Add an admin UI section for `営業評価` between `調査結果` and `営業提案書`.
- Update proposal/outreach generation so the initial contact follows the chosen policy: public email first, human review required, reply acquisition as the first goal, and a respectful free-diagnosis style rather than an aggressive sales pitch.
- Preserve the existing human-in-the-loop policy: no automatic outreach without human review.

## Capabilities

### New Capabilities
- `llm-revenue-audit`: Defines LLM-assisted sales assessment, structured audit output, guardrails, persistence, and admin display behavior.

### Modified Capabilities
- `proposal-generator`: Proposal generation must consume the structured revenue audit when available and keep outreach copy respectful, non-assertive, and focused on earning a reply.
- `outreach-sender`: Outreach behavior must follow the public-email-first, human-review-required, reply-acquisition-first policy.

## Impact

- Affected code:
  - `src/revenue-agent/runner.ts`
  - `src/revenue-audit/*`
  - `src/proposal-generator/*`
  - `src/outreach-sender/*`
  - `src/types/*`
  - `admin-ui/src/pages/runs.tsx`
  - `admin-ui/src/types.ts`
  - `admin-ui/src/utils.ts`
- Affected data:
  - Run summaries will store `llmRevenueAudit` when the LLM step succeeds.
  - Existing run summaries without `llmRevenueAudit` remain valid.
- Affected APIs:
  - Admin run-detail responses include the new summary field without changing endpoint shape.
- Dependencies:
  - Uses the existing `llm-provider` module and provider fallback behavior.
  - No outbound email should be sent without the existing human review controls.
