## 1. Data Model

- [x] 1.1 Add analyzed site, snapshot, and proposal tables to the SQLite schema.
- [x] 1.2 Implement a site results repository with upsert, list, detail, and snapshot/proposal mapping functions.

## 2. RevenueAgent Integration

- [x] 2.1 Persist site results when a RevenueAgent run produces a crawled target.
- [x] 2.2 Preserve generated proposal artifacts as site proposal records.

## 3. Site Results UI

- [x] 3.1 Add shared admin-token authentication helpers for protected internal UI routes.
- [x] 3.2 Add `/sites` list and `/sites/:id` detail routes.
- [x] 3.3 Mount the site routes in Express and forward them through the Cloudflare Worker.
- [x] 3.4 Add navigation links between the operations dashboard and site results dashboard.

## 4. Verification

- [x] 4.1 Add repository tests for site result persistence and history ordering.
- [x] 4.2 Add route tests for authenticated and unauthorized site result pages.
- [x] 4.3 Run build and test suite.
