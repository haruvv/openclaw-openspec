## 1. Storage Boundary

- [x] 1.1 Inventory current repository operations that read or write runs, steps, artifacts, sites, snapshots, proposals, targets, outreach, HIL, and payment records.
- [x] 1.2 Define an application storage interface that preserves the current admin API response contracts.
- [x] 1.3 Move the existing `better-sqlite3` behavior behind a SQLite storage adapter.
- [x] 1.4 Add configuration that selects SQLite storage when durable storage settings are absent.

## 2. Durable Schema and Artifacts

- [x] 2.1 Add D1 migration files for the operational tables and indexes currently required by the admin dashboard and RevenueAgent workflow.
- [x] 2.2 Add artifact metadata fields for inline bodies, object-backed bodies, content type, byte size, and object key.
- [x] 2.3 Define R2 object-key conventions for generated proposals and future large artifacts.
- [x] 2.4 Add tests that initialize the SQLite-compatible schema from committed migrations.

## 3. Worker Storage Bridge

- [x] 3.1 Add D1 and R2 bindings to the Cloudflare Worker configuration for production.
- [x] 3.2 Add authenticated internal Worker routes for the storage operations needed by the Container.
- [x] 3.3 Implement D1-backed relational operations in the Worker bridge.
- [x] 3.4 Implement R2-backed artifact body put/get operations in the Worker bridge.
- [x] 3.5 Ensure internal storage routes reject missing or invalid storage tokens.

## 4. Production Durable Adapter

- [x] 4.1 Implement a Container-side durable storage adapter that calls the Worker storage bridge.
- [x] 4.2 Batch run-completion and site-result writes to reduce storage bridge round trips.
- [x] 4.3 Store large artifact bodies in R2 while preserving small inline artifact reads.
- [x] 4.4 Switch production configuration to use durable storage while keeping local development on SQLite.

## 5. Migration and Operations

- [x] 5.1 Add a SQLite export command for existing ephemeral operational data.
- [x] 5.2 Add a D1/R2 import command or documented import flow for exported data.
- [x] 5.3 Update deployment documentation with clean-start and preserve-existing-data rollout paths.
- [x] 5.4 Document rollback steps that return production to SQLite mode without losing known D1-only writes.

## 6. Verification

- [x] 6.1 Add repository-level tests for SQLite adapter behavior and durable adapter request handling.
- [x] 6.2 Add Worker bridge tests for authenticated D1/R2 operations.
- [x] 6.3 Update the production smoke test to verify durable write/read behavior after deploy.
- [x] 6.4 Run typecheck, tests, build, OpenSpec status, and production deploy verification.
