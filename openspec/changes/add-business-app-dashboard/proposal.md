## Why

The current admin UI is centered on one workflow, SEO sales, even though the intended product is a management surface for multiple automated jobs such as SEO sales and future stock trading. The admin experience needs a higher-level business-app dashboard so each job has a clear home and can grow independently.

## What Changes

- Turn `/admin` into a business app portal instead of a run-list-first page.
- Introduce a reusable business app registry with SEO sales as the first app and stock auto-trading as a placeholder for future expansion.
- Move SEO sales screens under `/admin/seo-sales`.
- Keep backward-compatible redirects from existing `/admin/runs`, `/admin/integrations`, and `/sites` routes.
- Preserve existing run logs, site results, auth, and deployment behavior.

## Capabilities

### New Capabilities
- `business-app-dashboard`: Multi-job admin portal and app-specific navigation model.

### Modified Capabilities

## Impact

- Adds an admin portal route and app metadata module.
- Updates admin/site route paths and navigation links.
- Updates Worker forwarding for `/admin/seo-sales` and compatibility paths.
- Updates tests and deployment docs to reflect the new information architecture.
