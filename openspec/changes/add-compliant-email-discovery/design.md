## Context

The current crawler extracts public emails from site HTML and contact pages, then `crawlBatch` can require at least one email before creating a sales target. This misses valid business leads because many sites expose only forms, phone numbers, or no visible email. The outreach flow already requires reviewed sending from the admin UI, but it does not yet distinguish public business emails from provider-derived, personal, guessed, suppressed, or policy-blocked emails.

Hunter.io Domain Search is the primary enrichment source because it returns domain-associated emails, sources, confidence, verification status, and email type. Apollo.io is optional fallback for role/person search, but should be narrower because people databases can include personal or less relevant contacts. Compliance constraints are part of the product contract, not just UI copy.

## Goals / Non-Goals

**Goals:**
- Discover business contact emails when the site itself does not publish one.
- Restrict accepted candidates to business/domain emails and relevant role or generic business contacts.
- Exclude personal domains, personal email types, unrelated roles, suppressed emails/domains, and sites with sales-prohibited language.
- Treat guessed, accept-all, or unverified emails as low confidence and keep them behind human approval.
- Ensure reviewed outreach includes sender identity and an opt-out mechanism before SendGrid is called.

**Non-Goals:**
- No automatic form submission, DM sending, or manual task execution.
- No Hunter/Apollo lead list writes or sequence/campaign automation.
- No legal guarantee or jurisdiction-specific legal advice; the system implements conservative technical safeguards.
- No automatic sending without admin review.

## Decisions

1. **Provider-derived email candidates are screened before becoming contact methods.**
   - Decision: Add a dedicated email discovery module that returns only policy-screened `ContactMethod` values plus structured rejection reasons for logs/tests.
   - Rationale: The rest of the pipeline can continue consuming `ContactMethod[]` while compliance stays centralized.
   - Alternative considered: Put Hunter parsing directly in `site-crawler/firecrawl-client.ts`; rejected because provider parsing and legal filtering would be hard to test independently.

2. **Hunter Domain Search is primary; Apollo is optional fallback.**
   - Decision: Run Hunter when `HUNTER_API_KEY` is present. Run Apollo only when `APOLLO_API_KEY` is present and accepted Hunter candidates are below the configured target count.
   - Rationale: Hunter is domain-centric and better aligned with finding business addresses for a known site. Apollo is useful for role-based contacts but carries higher personal-data risk.
   - Alternative considered: Always run both providers; rejected to reduce data exposure and API costs.

3. **Business email eligibility is conservative.**
   - Decision: Accept emails only when the email domain matches the site domain or an allowed corporate domain, the domain is not a personal/free mailbox provider, and the local part or role metadata is business-relevant.
   - Rationale: The user explicitly wants法人・事業用メール限定, 個人メール回避, and role relevance.
   - Alternative considered: Accept all provider-verified emails; rejected because verified personal/person emails can still be inappropriate for cold outreach.

4. **Suppression is persistent and checked at discovery and send time.**
   - Decision: Store suppression entries by email and/or domain with reason and source. Discovery filters them out, and `sendReviewedOutreach` blocks any recipient/domain that has since been suppressed.
   - Rationale: “今後連絡不要” must be immediate and durable even if a previous draft still exists.
   - Alternative considered: Only filter at discovery time; rejected because old drafts could be sent later.

5. **Sales-prohibited sites are excluded before enrichment.**
   - Decision: Scan crawled HTML/text for explicit no-sales/no-solicitation language and skip email enrichment for such sites.
   - Rationale: Avoiding prohibited outreach is more important than maximizing candidate volume.
   - Alternative considered: Mark as low confidence; rejected because the user asked to exclude営業禁止表示.

6. **Sender identity and opt-out copy are enforced at send time.**
   - Decision: Before SendGrid, validate/append sender identity and opt-out instructions to the reviewed body text.
   - Rationale: Admins can edit drafts; enforcement must happen at the boundary where external side effects occur.
   - Alternative considered: Only include caveats in the UI; rejected because it does not protect the actual email.

## Risks / Trade-offs

- **Provider data may be stale or inaccurate** -> Require human approval, low confidence for guessed/accept-all/unverified candidates, and include evidence/source metadata.
- **Over-filtering can reduce leads** -> Keep rejected reasons observable in logs/tests so tuning is possible later.
- **Apollo may expose personal contacts** -> Keep Apollo optional and restrict to configured relevant titles/seniorities plus corporate-domain emails only.
- **Legal requirements vary by jurisdiction** -> Implement conservative safeguards from official guidance: accurate sender identity, clear commercial nature, physical/contact identity where configured, and working opt-out path/text.
- **Existing drafts may predate suppression** -> Check suppression in `sendReviewedOutreach` immediately before send.

## Migration Plan

1. Add SQLite table for contact suppression entries.
2. Add provider clients and compliance screening module.
3. Integrate fallback discovery into crawler after public site/contact-page extraction.
4. Add send-time policy validation and body footer enforcement.
5. Add tests for provider parsing, filtering, suppression, no-solicitation detection, and send blocking.
6. Rollback by disabling `HUNTER_API_KEY`/`APOLLO_API_KEY`; public-email extraction continues to work.
