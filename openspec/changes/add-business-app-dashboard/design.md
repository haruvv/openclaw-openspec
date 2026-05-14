## Context

The admin UI now has two SEO-sales-specific surfaces: `/admin` for operations and `/sites` for URL results. That was useful while validating the first workflow, but it does not match the broader direction: the product should manage multiple automated business jobs, where SEO sales is one app and future stock auto-trading or other agents can be added later.

## Goals / Non-Goals

**Goals:**
- Make `/admin` the top-level management portal for multiple business apps.
- Keep SEO sales as the first business app with clear app-specific navigation.
- Move SEO sales operational pages to `/admin/seo-sales/...`.
- Keep old URLs working through redirects so existing links are not broken immediately.
- Avoid introducing a database-backed app registry until dynamic app management is actually needed.

**Non-Goals:**
- Implementing stock auto-trading logic.
- Adding user/role management beyond the existing admin token.
- Changing RevenueAgent execution semantics.
- Archiving older OpenSpec changes.

## Decisions

1. **Static app registry first**

   Define business apps in code as a small registry. This keeps the first version simple and enough for known apps. A database table can be added later when apps become user-configurable.

2. **`/admin` becomes portal**

   `/admin` should answer "what jobs can I manage?" rather than "what runs happened?". SEO sales runs move to `/admin/seo-sales/runs`; URL results move to `/admin/seo-sales/sites`.

3. **Compatibility redirects**

   Existing `/sites`, `/admin/runs/:id`, and `/admin/integrations` links should continue to work by redirecting to the new SEO sales paths. This lowers rollout risk and preserves links already shared during testing.

4. **One shared auth boundary**

   All admin and app-specific pages continue to use the same `ADMIN_TOKEN` middleware. The change is information architecture, not a security model change.

## Risks / Trade-offs

- [Risk] Static registry requires code changes when adding a new app.
  → Mitigation: This is acceptable while the number of apps is small; the shape can later migrate to a database-backed registry without changing route semantics.
- [Risk] Redirects can hide outdated links.
  → Mitigation: Keep new navigation consistently pointing to `/admin/seo-sales/...` and document the canonical paths.
- [Risk] Route refactor can break tests or Worker forwarding.
  → Mitigation: Add route tests for portal and compatibility redirects, and verify Worker forwarding rules include the canonical admin paths.
