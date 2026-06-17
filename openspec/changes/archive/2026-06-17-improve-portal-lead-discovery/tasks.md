## 1. Discovery Source Model

- [x] 1.1 Add `portal_search` to lead source types, default source registries, labels, and adapter wiring without making it a primary default source.
- [x] 1.2 Add portal discovery settings/env mapping for target domains, explicit portal URLs, and per-source limits.

## 2. Portal Candidate Extraction

- [x] 2.1 Implement a `portal_search` adapter that searches configured portal domains or fetches configured portal URLs.
- [x] 2.2 Extract official business site URLs from portal profile pages while excluding portal-internal, directory, social, map, and reservation links.
- [x] 2.3 Preserve portal provenance including portal URL, domain, business name, phone, address/location, category, and extraction method.

## 3. Qualification and Merge Behavior

- [x] 3.1 Hold portal profile-only candidates with `portal_profile_only` before SEO analysis.
- [x] 3.2 Ensure official-site candidates from portal search can merge with Google Maps and other source provenance.

## 4. Admin UI

- [x] 4.1 Add portal discovery as a selectable source with copy explaining it is portal/site-scoped, not whole-web search.
- [x] 4.2 Add admin settings fields for portal domains and portal URLs and persist them through the existing settings API.

## 5. Verification

- [x] 5.1 Add unit tests for portal official-link extraction and profile-only handling.
- [x] 5.2 Add tests for discovery qualification/source behavior and admin settings serialization.
- [x] 5.3 Run OpenSpec validation, targeted tests, and build verification.
