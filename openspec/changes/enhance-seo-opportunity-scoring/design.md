## Context

RevenueAgentPlatform currently treats Lighthouse SEO score as the primary measurable SEO signal. That score is useful for technical hygiene, but it is not enough for outreach: a page can pass Lighthouse while still lacking search-targeted copy, strong headings, trust elements, internal links, or clear conversion paths.

The crawler already obtains HTML through Firecrawl and runs Lighthouse. The proposal generator and admin UI already display a numeric score and diagnostics. This change should reuse those paths while adding richer, structured opportunity data.

## Goals / Non-Goals

**Goals:**

- Add an opportunity-oriented score that answers "is there a credible improvement angle for outreach?"
- Keep Lighthouse SEO score as a separate technical metric.
- Produce structured findings that can be displayed in the admin UI and reused in proposals.
- Make the first implementation deterministic and testable from crawled HTML and Lighthouse output.
- Avoid introducing mandatory paid APIs or LLM calls into the crawl scoring path.

**Non-Goals:**

- Do not replace Lighthouse.
- Do not implement full keyword rank tracking, backlink analysis, or Search Console integration.
- Do not require competitor SERP crawling in the first version.
- Do not automatically send outreach based only on the new score without existing policy gates.

## Decisions

### Decision: Add `opportunityScore` beside `seoScore`

The existing `seoScore` remains the Lighthouse score. A new `opportunityScore` represents sales-relevant improvement opportunity on a 0-100 scale, where higher means more improvement opportunity and stronger outreach fit.

Alternatives considered:

- Reinterpret `seoScore`: rejected because existing records, tests, UI, and proposal language already assume it means Lighthouse SEO.
- Replace numeric scoring with findings only: rejected because sorting, filtering, dashboards, and daily automation need a compact prioritization signal.

### Decision: Score deterministic categories first

The first version computes opportunity findings from HTML, metadata, URL, Lighthouse diagnostics, and extracted contact/trust/conversion signals. Categories:

- Technical SEO: Lighthouse diagnostics, crawlability, canonical, robots, structured data, image alt.
- Content SEO: title quality, meta description quality, heading structure, thin copy, service/industry specificity, FAQ or explanatory content.
- Search intent fit: whether page copy clearly names the service, audience, location if applicable, and problem/solution language.
- Conversion readiness: visible contact path, CTA wording, form/contact link, phone/email, booking or consultation path.
- Trust and proof: testimonials, case studies, reviews, certifications, company details, pricing/service detail pages.

Alternatives considered:

- LLM-only scoring: rejected for cost, latency, and reproducibility.
- Competitor-based scoring first: rejected because it requires query selection and SERP providers before the local page analysis is reliable.

### Decision: Store findings as structured records

Each finding should include category, severity, title, evidence, recommendation, and score impact. This allows the admin UI, proposal generator, and future automation to use the same data without reparsing prose.

Alternatives considered:

- Store one generated paragraph: rejected because it is hard to filter, test, translate, or convert into UI.
- Store only category totals: rejected because proposals need concrete reasons.

### Decision: Target selection uses opportunity score, not only low Lighthouse SEO

Automatic discovery should be able to keep a site with Lighthouse SEO 100 if the opportunity score is high enough. The existing threshold behavior should remain configurable for compatibility, but new automation should prioritize opportunity score.

Alternatives considered:

- Keep filtering on Lighthouse score only: rejected because it directly misses the problem this change addresses.
- Select every reachable site: rejected because daily automation needs a bounded and explainable queue.

### Decision: Proposal generation consumes opportunity findings

The proposal generator should mention concrete opportunity findings before generic Lighthouse diagnostics. Lighthouse diagnostics are still useful as supporting evidence, especially for technical issues.

Alternatives considered:

- Keep proposals unchanged and only alter admin scoring: rejected because the user-facing sales artifact would still be weak for Lighthouse-100 sites.

## Risks / Trade-offs

- [Risk] Heuristic scoring can be imperfect or overstate an issue. → Mitigation: show evidence snippets and severity, keep scoring transparent, and make findings editable later if needed.
- [Risk] More parsing can slow crawl runs. → Mitigation: use already fetched HTML, avoid extra network calls in v1, and cap page analysis to reasonable text lengths.
- [Risk] The score direction may confuse users because `seoScore` higher is better while `opportunityScore` higher means more opportunity. → Mitigation: label clearly as "改善余地スコア" or "営業優先度" in Japanese UI.
- [Risk] Existing stored rows lack opportunity fields. → Mitigation: treat missing values as unavailable and keep old rows readable.

## Migration Plan

1. Add optional opportunity fields to runtime types and storage.
2. Add migrations for durable storage and local SQLite schema updates.
3. Compute opportunity findings during crawl scoring.
4. Persist opportunity data in run summaries and site snapshots.
5. Update admin UI labels and proposal generation.
6. Deploy with backward-compatible reads for rows that only have Lighthouse data.

Rollback strategy: keep the Lighthouse-only path intact. If scoring causes issues, disable opportunity-based target filtering by configuration and continue to display Lighthouse score.

## Open Questions

- Should the UI surface `opportunityScore` as a raw number, a priority label, or both?
- What default threshold should count as a strong outreach target?
- Should LLM enrichment be added later as an optional second pass for high-value candidates?
