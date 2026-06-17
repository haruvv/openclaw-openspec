## Context

The current discovery pipeline supports seed URLs, Firecrawl search, Google Maps, Programmable Search Engine based `google_search`, Apollo organization search, and technology intelligence. After the latest product decision, Google Maps and Firecrawl are primary discovery sources; Programmable Search Engine is a supplemental portal/site-restricted source rather than whole-web search.

Many Japanese SEO sales targets are represented on industry portals before their official site is found. Examples include clinic directories, legal/accounting portals, salon/local business directories, renovation/construction portals, and school/service directories. These pages often contain a business name, address, phone number, category, and an outbound official website link. If the system treats the portal page itself as the target site, SEO analysis is wasted on the portal rather than the business.

## Goals / Non-Goals

**Goals:**

- Add a first-class portal discovery source that can search configured portal domains and extract official business site URLs.
- Keep Google Maps as the primary local-business source and use portal discovery as supplemental evidence.
- Hold portal profile pages when no official site URL is available, instead of crawling the portal as the business website.
- Preserve portal provenance so candidates can be merged with Google Maps and prioritized using multiple-source confirmation.
- Expose portal discovery configuration clearly in the admin UI.

**Non-Goals:**

- Do not automate scraping behind login, paywalls, or terms-hostile flows.
- Do not add form submission or DM automation.
- Do not use Programmable Search Engine as a general whole-web search replacement.
- Do not implement a separate parser for every possible portal in the first iteration.

## Decisions

1. **Represent portal discovery as a dedicated source id.**
   - Decision: Add `portal_search` as a `LeadSourceId` and adapter.
   - Rationale: The source has distinct semantics from `google_search`: it searches configured portal domains and must extract outbound official URLs.
   - Alternative considered: Keep overloading `google_search`; rejected because it preserves the confusing “Google web search” mental model.

2. **Use configurable portal targets rather than hard-coded one-off scrapers only.**
   - Decision: Maintain a curated default list of portal domains/categories, with env/admin overrides for target domains.
   - Rationale: Portals will evolve by industry. A configurable model allows adding sources without code changes.
   - Alternative considered: Build dedicated adapters per industry portal first; rejected for initial iteration because it would increase maintenance before we know which portals perform.

3. **Extract official site URLs conservatively.**
   - Decision: A portal result may yield either an official business URL candidate or a portal profile-only candidate. Profile-only candidates are held before SEO crawl.
   - Rationale: Crawling and scoring the portal domain would produce false SEO opportunities.
   - Alternative considered: Crawl portal pages as targets and rely on qualification to reject them; rejected because it wastes quota and hides useful provenance.

4. **Keep provenance-rich merge behavior.**
   - Decision: Portal candidates should include portal URL, portal domain, detected business name, location, phone, category, and extraction method in metadata/contact hints.
   - Rationale: This helps merge with Google Maps and explain why a candidate was selected.

## Risks / Trade-offs

- **Portal HTML varies widely** -> Start with generic official-link extraction and allow per-domain rules later.
- **Portals may block scraping** -> Prefer API/search-result snippets where possible, skip failures, and avoid bypassing access controls.
- **False official links** -> Exclude links to known social/directory/payment/map domains and require valid external domains.
- **Additional discovery cost** -> Keep source disabled unless selected or limited by source quota; record per-source candidate counts.
- **Duplicate or stale portal data** -> Merge by official URL/domain, phone, and business name/location rather than trusting a single portal.

## Migration Plan

1. Add `portal_search` source id and adapter behind configuration.
2. Add settings/env support for portal target domains and source enablement.
3. Add admin UI labels and explanatory copy.
4. Add tests for official-link extraction, profile-only holding, source reports, and default source behavior.
5. Deploy without enabling portal search by default unless the configured settings include it.

Rollback is low risk: disable `portal_search` in settings or remove it from `REVENUE_AGENT_DISCOVERY_SOURCES`; other discovery sources continue to run independently.

## Open Questions

- Which portal domains should be enabled by default for the first production trial?
- Should portal targets be industry-specific in UI immediately, or start with a single allowlist field?
- Should profile-only portal candidates be persisted for manual enrichment, or only reported in skipped reasons during the first iteration?
