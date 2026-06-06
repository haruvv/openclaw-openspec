## 1. Discovery Domain Model

- [x] 1.1 Add lead source, raw candidate, normalized site candidate, source provenance, stage event, contact hint, route decision, and priority score types under `src/discovery`.
- [x] 1.2 Extend shared contact method types to include form, phone, social DM, maps profile, and manual routes without breaking existing email/contact page handling.
- [x] 1.3 Add normalization helpers for comparable URLs, registrable domains, source-specific IDs, and business identity keys.
- [x] 1.4 Add unit tests for candidate normalization and weak/strong dedupe identity behavior.

## 2. Storage And Migrations

- [x] 2.1 Add SQLite/Durable-compatible schema for lead candidates, candidate sources, stage events, contact methods, priority scores, and route decisions.
- [x] 2.2 Implement repository functions to upsert candidates, merge source provenance, append stage events, save contact methods, save priority scores, and save route decisions.
- [x] 2.3 Ensure stored provider metadata is sanitized and does not expose API keys, authorization headers, or raw secret-bearing payloads.
- [x] 2.4 Add storage migration tests covering table creation, candidate/source upsert, stage history, and route decision persistence.

## 3. Source Adapter Registry

- [x] 3.1 Implement the `LeadSourceAdapter` contract and source registry for enabled discovery sources.
- [x] 3.2 Wrap existing seed URL discovery as a source adapter.
- [x] 3.3 Wrap existing Firecrawl/search discovery as the search-source adapter while preserving current query, country, language, location, and limit behavior.
- [x] 3.4 Add Google Search API adapter scaffolding with configuration validation and normalized result output.
- [x] 3.5 Add Google Maps/local business adapter scaffolding with Place ID, business metadata, website URL, phone, and maps profile contact hints.
- [x] 3.6 Add technology-intelligence adapter scaffolding for BuiltWith/Wappalyzer-style providers with domain and detected technology output.
- [x] 3.7 Add adapter tests for success, provider failure isolation, missing configuration skips, and source run reporting.

## 4. Candidate Collection And Dedupe

- [x] 4.1 Update discovery settings to support enabled sources and per-source limits while preserving legacy seed URL/search query settings.
- [x] 4.2 Replace direct candidate merging in `runDailyDiscoveryJob` with adapter execution, normalization, provenance merge, and layered dedupe.
- [x] 4.3 Record candidate collection and normalization stage events for every accepted, merged, skipped, or provider-failed candidate.
- [x] 4.4 Ensure one failed source does not fail the whole discovery job when other sources produce usable candidates.
- [x] 4.5 Add discovery job tests for multi-source collection, duplicate provenance merge, source failure continuation, and legacy settings compatibility.

## 5. Site Qualification And SEO Qualification

- [x] 5.1 Implement business/site qualification for company, store, clinic, local service, and service-provider official sites.
- [x] 5.2 Add rejection handling for directories, articles, marketplace listings, social-only profiles, personal blogs, blocked pages, and unrelated domains.
- [x] 5.3 Update crawler input handling so normalized site candidates carry source provenance, business metadata, and contact hints into crawl results.
- [x] 5.4 Update SEO issue qualification to produce pass/reject/hold status with thresholds, Lighthouse diagnostics, opportunity findings, and reason codes.
- [x] 5.5 Preserve current URL-list crawl behavior and current Lighthouse timeout/fallback behavior.
- [x] 5.6 Add crawler tests for candidate metadata propagation, business-site pass/reject decisions, Maps-profile-only hold behavior, and SEO issue qualification.

## 6. Contact Discovery And Route Decisions

- [x] 6.1 Implement contact method normalization from crawl results, source contact hints, site links, and existing public email extraction.
- [x] 6.2 Rank contact methods by confidence and supported operational route.
- [x] 6.3 Implement delivery route selection for email send, contact form queue, social/DM queue, manual follow-up queue, duplicate skip, and policy hold.
- [x] 6.4 Update outreach sending so SendGrid is called only when the selected route is email send.
- [x] 6.5 Change missing-email behavior from hard skip to non-email route decision when a form, social/DM, phone, maps profile, or manual route is available.
- [x] 6.6 Add outreach tests for email route sending, form queue routing, DM/manual routing, missing-email routing, and cooldown duplicate skips.

## 7. Sales Priority Scoring

- [x] 7.1 Implement deterministic priority score calculation with SEO severity, business fit, source confidence, source confirmation count, contactability, duplicate/cooldown state, and operational constraints.
- [x] 7.2 Save score totals, priority labels, and component breakdowns for admin/API display.
- [x] 7.3 Use priority score to select candidates when discovery candidates exceed daily run quota.
- [x] 7.4 Use manual queue capacity to select or hold manual-route candidates.
- [x] 7.5 Add prioritization tests for high-priority leads, contactability penalties, duplicate/cooldown suppression, quota ordering, and manual capacity behavior.

## 8. Admin API And UI

- [x] 8.1 Extend admin discovery settings API to expose enabled sources and source-specific status/configuration without exposing secrets.
- [x] 8.2 Add admin API responses for candidate source mix, stage status, contact methods, priority score, and route decision.
- [x] 8.3 Update SEO sales discovery UI to configure source mix and show provider configuration state.
- [x] 8.4 Update site/run/candidate views to display provenance, stage timeline, SEO qualification reason, contact routes, priority score, and manual/non-email queues.
- [x] 8.5 Add admin route and UI tests for source settings, candidate detail payloads, route decisions, and queue display.

## 9. Operational Safety And Verification

- [x] 9.1 Keep discovery-triggered revenue agent runs side-effect disabled unless an explicit reviewed route action enables a side effect.
- [x] 9.2 Add structured logs for source execution, candidate counts, dedupe merges, qualification drop-offs, scoring, and route decisions.
- [x] 9.3 Update smoke tests to cover a discovery run that produces candidates from multiple sources without sending email, Telegram, or payment links.
- [x] 9.4 Run `npm test` and targeted admin/discovery/crawler/outreach test suites.
- [x] 9.5 Run `openspec validate multi-source-lead-discovery --strict` before implementation handoff.
