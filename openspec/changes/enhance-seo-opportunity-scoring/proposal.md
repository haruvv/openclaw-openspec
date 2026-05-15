## Why

Current SEO scoring relies on Lighthouse's SEO category score, which mainly checks technical basics. Sites can score 100 while still having weak search intent alignment, thin content, poor conversion paths, or clear sales-relevant improvement opportunities, so the platform needs a richer scoring model for outreach prioritization.

## What Changes

- Add an SEO opportunity scoring model that complements the existing Lighthouse SEO score instead of replacing it.
- Evaluate target pages across technical SEO, content quality, search intent fit, conversion readiness, and trust signals.
- Persist and expose structured opportunity findings so the admin UI and proposal generator can explain why a site is a good outreach target.
- Update target selection logic to support opportunity-based prioritization, including cases where Lighthouse SEO is high.
- Keep the existing Lighthouse `seoScore` field for compatibility and historical comparison.

## Capabilities

### New Capabilities
- `seo-opportunity-scoring`: Defines the richer scoring contract, finding categories, priorities, and target eligibility behavior.

### Modified Capabilities
- `site-crawler`: The crawler output changes from Lighthouse-only scoring to include opportunity findings and an opportunity score.
- `proposal-generator`: Proposals must use opportunity findings, not only Lighthouse diagnostics, when generating sales-oriented improvement recommendations.

## Impact

- Affected code:
  - `src/site-crawler/*`
  - `src/types/*`
  - `src/revenue-agent/runner.ts`
  - `src/proposal-generator/*`
  - `src/sites/*`
  - `src/storage/*`
  - `admin-ui/src/main.tsx`
- Affected data:
  - Site snapshots and run summaries will need to store opportunity score and structured findings.
  - Existing `seoScore` data remains valid.
- Affected APIs:
  - Admin run/site responses should include opportunity score and findings where available.
  - Existing fields should remain backward compatible.
- Dependencies:
  - Lighthouse remains in use.
  - Initial implementation should prefer deterministic local analysis from crawled HTML and Lighthouse output; LLM enrichment can be added later behind a separate opt-in path if needed.
