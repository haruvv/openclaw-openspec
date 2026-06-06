## Context

The current discovery path is centered on seed URLs and Firecrawl search results. `runDailyDiscoveryJob` merges candidates, removes already analyzed sites, optionally checks for a public email, then runs the revenue agent for each selected URL. The crawler then fetches a URL, measures Lighthouse SEO, computes an opportunity score, and the sales flow builds an email-first outreach draft.

This works for direct URL or search-query discovery, but it couples "finding a possible business" with "having a URL and email now." That coupling drops useful leads from Google Maps/local listings, technology intelligence sources, and businesses where the best contact route is a form, phone, social DM, or manual follow-up.

The new pipeline should preserve the existing safe default behavior: discovery runs must not send email, Telegram notifications, or payment links automatically. It should also keep provider-specific details outside the core qualification and routing logic.

## Goals / Non-Goals

**Goals:**

- Support multiple lead exploration sources behind a common adapter contract.
- Start with source types for Google Search API, Google Maps/local business discovery, BuiltWith/Wappalyzer-style technology discovery, and seed URLs.
- Normalize source-specific results into site candidates that include provenance, source confidence, business metadata, and contact hints.
- Deduplicate candidates across sources before crawling or running Lighthouse.
- Make the downstream pipeline explicit: source discovery, site candidate collection, business/site qualification, SEO issue qualification, contact method discovery, sales priority scoring, and route selection.
- Allow future discovery sources to be added by registering an adapter and settings, without changing the core orchestration contract.
- Support route-aware outcomes: email send, contact form queue, DM/social queue, and manual follow-up queue.

**Non-Goals:**

- Implement browser automation for submitting contact forms in this change.
- Automatically send DMs through social platforms in this change.
- Replace Lighthouse, Firecrawl, or the existing revenue audit generator.
- Remove existing seed URL and search-query based discovery.
- Make provider-specific scoring rules part of the public pipeline contract.

## Decisions

### Use a discovery source adapter contract

Introduce a `LeadSourceAdapter` interface under `src/discovery` with a stable shape similar to:

```ts
interface LeadSourceAdapter {
  id: LeadSourceId;
  discover(input: LeadSourceInput, context: LeadDiscoveryContext): Promise<RawLeadCandidate[]>;
}
```

Adapters return raw source results, not final targets. A normalization layer maps them into `SiteCandidate` records with fields such as `url`, `domain`, `sourceProvenance`, `sourceConfidence`, `businessName`, `category`, `location`, `technologies`, `contactHints`, and `metadata`.

Rationale: source providers differ heavily in fields, quotas, and reliability. A common adapter keeps provider details isolated while letting the rest of the pipeline work from one contract.

Alternatives considered:

- Put provider-specific branches directly inside `runDailyDiscoveryJob`. This is faster initially but makes every new source touch orchestration, dedupe, settings, and tests.
- Convert each source directly into an agent run. This preserves today’s behavior but prevents cross-source dedupe and priority scoring before expensive crawl/Lighthouse work.

### Split candidate collection from qualification

Discovery should produce candidates; qualification should decide whether a candidate is worth crawling, scoring, and routing. The qualification stages should be explicit:

- `candidate_collected`
- `business_site_qualified` or `business_site_rejected`
- `seo_issue_qualified` or `seo_issue_rejected`
- `contact_methods_discovered`
- `priority_scored`
- `routed`

Business/site qualification checks whether the candidate appears to be a company, store, clinic, local service, or service provider site rather than a directory, article, marketplace listing, personal blog, blocked page, or unrelated domain. SEO issue qualification keeps the existing Lighthouse/opportunity score behavior but records why a site did or did not qualify.

Rationale: this makes drop-off visible and avoids treating all skipped leads as the same failure class.

Alternatives considered:

- Keep the current "run agent for every selected URL" approach. That is simpler, but it spends crawl and Lighthouse work on weak candidates and hides where leads are lost.

### Deduplicate on canonical business/domain identity

Deduplication should happen before expensive processing and should use layered keys:

- Normalized URL without query or hash.
- Registrable domain when available.
- Source-specific business identifiers such as Google Place ID.
- Optional business identity tuple: normalized business name, category, and location.

The deduper should merge provenance instead of dropping it. If Google Maps and BuiltWith find the same domain, the surviving candidate should retain both source records and the higher aggregate confidence.

Rationale: the same lead may appear through local search, web search, and technology discovery. Keeping provenance improves scoring and debugging.

Alternatives considered:

- Deduplicate only by URL. This misses local listings where the URL differs or appears later.
- Deduplicate only by domain. This can over-merge multi-location or multi-brand businesses on shared domains.

### Treat contact discovery as route discovery, not email extraction

Extend the contact method model beyond email to include:

- `email`
- `form`
- `phone`
- `contact_page`
- `social_dm`
- `maps_profile`
- `manual`

The crawler and discovery adapters may contribute contact hints. A contact normalization step should rank routes by confidence and operational support. Email can remain the first automatically sendable route, but a missing email should no longer remove a candidate by default.

Rationale: useful local business leads often expose a phone number, contact page, map profile, or Instagram account before a plain email address.

Alternatives considered:

- Continue requiring email before agent runs. This reduces operational work but is the primary cause of missed leads.
- Treat all non-email routes as free-form notes. That loses routing structure needed by admin UI and manual queues.

### Add sales priority scoring after SEO qualification

Introduce a deterministic `lead-prioritization` service that returns a score and component breakdown. Inputs should include:

- SEO issue severity and opportunity score.
- Candidate source confidence and number of confirming sources.
- Business/site fit.
- Contactability and supported route.
- Duplicate/cooldown status.
- Operational constraints such as daily quota and manual queue capacity.

The score should rank leads for processing and outreach. It should not replace the LLM revenue audit, and the LLM must not be the source of truth for deterministic score components.

Rationale: once discovery sources expand, the system needs to choose which leads deserve limited crawl, review, and outreach capacity.

Alternatives considered:

- Use only SEO score threshold. This ignores contactability and source quality.
- Ask the LLM to rank every lead. This is harder to test, costlier, and less predictable.

### Route outcomes through a delivery router

Add a routing step that turns a qualified, scored lead into one of:

- `send_email`
- `queue_contact_form`
- `queue_social_dm`
- `queue_manual_follow_up`
- `skip_duplicate`
- `hold_policy_blocked`

Existing SendGrid sending and cooldown checks remain the email implementation. Non-email routes should create structured queue records and admin-visible status first; automation for form/DM submission can be added later.

Rationale: this keeps side effects controlled while acknowledging that many qualified leads need non-email handling.

Alternatives considered:

- Add form and DM sending immediately. That has higher platform-policy and reliability risk.
- Leave non-email routes outside the system. That keeps the current leak in the funnel.

### Store provenance and stage status with existing site/run records

Add persistence for candidate/provenance and stage statuses. This can be a new set of discovery tables, or an extension of site snapshots if the storage model can remain clear:

- `lead_candidates`
- `lead_candidate_sources`
- `lead_stage_events`
- `lead_contact_methods`
- `lead_priority_scores`
- `lead_route_decisions`

Existing `sites`, `site_snapshots`, `agent_runs`, and `sales_outreach_messages` should remain the operational record for analyzed sites and email sends.

Rationale: discovery candidates can exist before a site snapshot or agent run, so forcing them into current site records would blur lifecycle states.

Alternatives considered:

- Store everything in agent run metadata. This is quick but weak for querying, dedupe, reporting, and retrying specific stages.

## Risks / Trade-offs

- Provider quotas and pricing can limit source coverage -> keep source adapters independently configurable and enforce per-source limits before global daily quota.
- Maps and technology intelligence results may contain stale or indirect domains -> require business/site qualification and provenance confidence before crawl/score.
- More stages increase state complexity -> record compact stage events with stable status codes and keep existing run records for executed analyses.
- Non-email routes introduce manual workload -> include manual queue capacity in priority scoring and route excess leads to hold/skip statuses.
- Cross-source dedupe can incorrectly merge distinct businesses -> keep merged source evidence inspectable and avoid merging solely on weak name matches.
- Additional external providers increase secret handling risk -> keep provider credentials in existing settings/env patterns and never expose raw provider payloads or secrets in admin/API responses.

## Migration Plan

1. Add source adapter types, normalized candidate types, and source registry with seed URL and current Firecrawl/search behavior wrapped as initial adapters.
2. Add storage migration for candidates, source provenance, stage events, contact methods, priority scores, and route decisions.
3. Change discovery settings to support enabled sources and per-source configuration while preserving current query, seed URL, quota, country, language, and location fields.
4. Update `runDailyDiscoveryJob` to collect from enabled adapters, normalize, merge provenance, dedupe, qualify candidates, score priority, and start revenue-agent runs only for selected candidates.
5. Update crawler input/output to accept normalized candidate metadata and return business/site qualification plus SEO issue qualification reasons.
6. Update sales routing so missing email produces a route decision instead of a hard discovery skip.
7. Update admin APIs and UI to show source mix, stage status, contact routes, priority score, and manual/non-email queues.
8. Keep legacy env/settings behavior working by mapping old discovery query settings into the Google/Search adapter configuration.

Rollback strategy: keep the existing seed/search discovery path available behind a source configuration flag. If multi-source discovery causes issues, disable new adapters and route handling while continuing to run the existing URL/search-based discovery path.

## Open Questions

- Which provider should be the first concrete implementation for Google Maps/local business discovery, and what fields will be available under the chosen API/plan?
- Should BuiltWith and Wappalyzer both be supported initially, or should the first implementation define a generic technology-intelligence adapter with one provider enabled?
- What manual follow-up queue UX is required for the first release: admin-only list, assignment, notes, or export?
- Should phone-based contact be treated as manual follow-up only, or should it have a separate route/status?
- What default scoring weights should be used for source confidence, SEO issue severity, and contactability?
