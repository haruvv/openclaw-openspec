## 1. Persistence

- [x] 1.1 Add generic agent run, step, and artifact tables to the SQLite schema.
- [x] 1.2 Implement an agent run repository for creating, completing, listing, and reading runs.
- [x] 1.3 Implement artifact persistence helpers for proposal paths and readable proposal content.

## 2. RevenueAgent Instrumentation

- [x] 2.1 Extend RevenueAgent run options to accept source and metadata for persisted runs.
- [x] 2.2 Record RevenueAgent runs as running before work starts and complete them with steps, summary, outputs, and artifacts.
- [x] 2.3 Pass source metadata from API, Telegram, and admin/manual entry points.

## 3. Admin API and UI

- [x] 3.1 Add admin routes for run list, run detail, manual run, retry, and integration status.
- [x] 3.2 Build server-rendered admin HTML views with readable run status, step status, artifacts, and provider configuration state.
- [x] 3.3 Mount the admin routes under `/admin` in the existing Express server.

## 4. Verification and Documentation

- [x] 4.1 Add focused tests for persistence and admin route behavior.
- [x] 4.2 Update deployment documentation with the admin dashboard entry point and operational caveats.
- [x] 4.3 Run build and test, then verify OpenSpec status.
