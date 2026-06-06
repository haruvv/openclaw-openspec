## Why

Current lead discovery relies too heavily on web search followed by site fetch, SEO scoring, and email extraction, which makes it easy to miss viable local businesses, technology-based prospects, and targets whose contact route is not exposed as a plain email address.
This change introduces a source-agnostic lead exploration pipeline so additional discovery sources can be added over time without reshaping the downstream qualification and outreach flow.

## What Changes

- Introduce a pluggable lead source layer that can collect candidates from Google Search API, Google Maps/local business search, and technology intelligence sources such as BuiltWith or Wappalyzer.
- Normalize discovered leads into site candidates with source provenance, confidence, business metadata, and deduplication across sources.
- Split the current linear flow into explicit stages: lead exploration source, site candidate collection, business/site/service-site qualification, SEO issue qualification, contact method discovery, sales priority scoring, and delivery routing.
- Add support for contact routes beyond extracted email, including contact forms, social/DM links, and manual follow-up queues.
- Add a sales priority score that ranks leads by SEO issue severity, business fit, source confidence, contactability, and operational constraints.
- Keep the architecture extensible so future discovery sources can be registered without changing the core pipeline contract.

## Capabilities

### New Capabilities

- `lead-source-discovery`: Defines pluggable discovery source adapters, candidate normalization, source provenance, deduplication, and initial support for Google Search API, Google Maps/local business discovery, and BuiltWith/Wappalyzer-style technology discovery.
- `lead-prioritization`: Defines sales priority scoring for qualified leads using SEO issue severity, business relevance, source confidence, contactability, and routing constraints.

### Modified Capabilities

- `site-crawler`: Changes the crawler contract from directly accepting search-derived URLs/keywords into processing normalized site candidates, qualifying whether each candidate is a company/store/service site, and determining whether SEO issues are actionable before target extraction.
- `outreach-sender`: Changes outreach from email-only sending to route-aware handling across email, contact form, DM/social contact, and manual follow-up outcomes while preserving send limits and duplicate protection.

## Impact

- Affected pipeline stages: discovery, crawling, qualification, SEO scoring, contact extraction, priority scoring, and outreach routing.
- Affected providers and dependencies: Google Search API, Google Maps/local business data, BuiltWith or Wappalyzer-style technology data, Firecrawl, Lighthouse, SendGrid, and any future source adapter providers.
- Affected data model: lead source records, normalized site candidates, source provenance, qualification status, SEO issue status, contact routes, priority score, and routing decision.
- Affected APIs and admin surfaces: any endpoint or UI that starts discovery runs, displays target lists, reports pipeline step status, or queues outreach/manual follow-up.
