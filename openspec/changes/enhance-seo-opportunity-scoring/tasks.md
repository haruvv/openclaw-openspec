## 1. Data Model and Storage

- [x] 1.1 Add `opportunityScore` and `opportunityFindings` types to shared target/result models.
- [x] 1.2 Add local SQLite and durable storage schema support for opportunity score and findings on site snapshots.
- [x] 1.3 Update repository read/write mapping to preserve existing rows where opportunity data is absent.

## 2. Scoring Engine

- [x] 2.1 Create a deterministic SEO opportunity scoring module that accepts crawled HTML, metadata, and Lighthouse diagnostics.
- [x] 2.2 Implement technical, content, intent, conversion, and trust finding categories.
- [x] 2.3 Convert findings into a 0-100 `opportunityScore` where higher means stronger improvement opportunity.
- [x] 2.4 Add unit tests for high-Lighthouse-score pages that still produce meaningful opportunity findings.
- [x] 2.5 Add unit tests for strong pages that produce low opportunity scores.

## 3. Crawl and Run Integration

- [x] 3.1 Update crawler output to include `opportunityScore` and `opportunityFindings`.
- [x] 3.2 Update target filtering so high Lighthouse SEO sites can still be selected when opportunity score is high.
- [x] 3.3 Add configuration for opportunity-score threshold while keeping existing Lighthouse threshold behavior compatible.
- [x] 3.4 Include opportunity fields in RevenueAgent run summaries and step details.

## 4. Proposal and Admin UI

- [x] 4.1 Update proposal generation prompts/content to use opportunity findings before generic Lighthouse diagnostics.
- [x] 4.2 Update admin overview, run detail, and site detail views to show 改善余地スコア and key findings.
- [x] 4.3 Use Japanese labels that distinguish Lighthouse SEO score from 営業/改善余地 score.

## 5. Verification and Documentation

- [x] 5.1 Update existing crawler, proposal, site repository, and admin route tests.
- [x] 5.2 Add migration or storage compatibility tests for missing opportunity fields.
- [x] 5.3 Run `npm run lint`, `npm run build`, and relevant tests.
- [x] 5.4 Update operational documentation to explain how the two SEO-related scores differ.
