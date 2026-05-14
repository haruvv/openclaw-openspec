## Why

RevenueAgent now has an operations dashboard, but that view is run-centric: it is useful for debugging execution failures, not for reviewing the latest state of each analyzed URL. As crawling becomes automatic, users need a stable site/result surface where each URL has a latest score, proposal, and history without starting from low-level run logs.

## What Changes

- Add a site results dashboard separate from `/admin`.
- Persist analyzed sites and per-run snapshots so each URL/domain has a latest result and historical crawl/proposal records.
- Link site results back to agent runs for debugging while keeping the primary UX site-centric.
- Keep the data model extensible for future analysis types beyond SEO.
- Protect the results surface with the same admin token policy used by the operations dashboard.

## Capabilities

### New Capabilities
- `site-results-dashboard`: Site-centric analysis result storage and UI for latest status, score, proposal, and history.

### Modified Capabilities

## Impact

- Adds SQLite tables for analyzed sites, snapshots, and proposal records.
- Adds repository and route modules for site results.
- Updates RevenueAgent run completion to populate both run logs and site result state.
- Updates the Cloudflare Worker routing to expose the results UI.
- Adds tests for repository persistence and authenticated route rendering.
