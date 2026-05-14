## ADDED Requirements

### Requirement: Operational records persist outside the Container filesystem
The system SHALL store production operational records in durable storage outside the Cloudflare Container filesystem.

#### Scenario: Run history survives Container replacement
- **WHEN** a production Container is replaced after a deploy or sleep cycle
- **THEN** previously completed agent runs remain visible through the admin run history

#### Scenario: Site results survive Container replacement
- **WHEN** a production Container is replaced after a deploy or sleep cycle
- **THEN** previously analyzed site records remain visible through the admin URL results pages

### Requirement: Durable storage preserves current admin data contracts
The system SHALL preserve the existing admin API response shapes while changing the backing production storage.

#### Scenario: Admin overview reads durable data
- **WHEN** the admin dashboard requests the SEO営業 overview
- **THEN** the response includes totals, recent runs, and recent sites from durable storage

#### Scenario: Run detail reads durable data
- **WHEN** the admin dashboard requests a run detail by ID
- **THEN** the response includes the run, steps, and artifacts stored for that run

#### Scenario: Site detail reads durable data
- **WHEN** the admin dashboard requests a site detail by ID
- **THEN** the response includes the site, snapshots, and proposal records stored for that site

### Requirement: Large artifacts use durable object storage
The system SHALL store large generated artifact bodies in durable object storage and keep retrievable metadata in the relational durable store.

#### Scenario: Proposal body is stored durably
- **WHEN** a generated proposal body exceeds the inline artifact threshold
- **THEN** the proposal body is written to durable object storage
- **AND** the relational artifact record stores the object key and metadata needed to retrieve it

#### Scenario: Admin detail loads stored artifact body
- **WHEN** the admin dashboard opens a run or site detail containing an object-backed artifact
- **THEN** the system retrieves the artifact body from durable object storage or returns a clear missing-artifact placeholder

### Requirement: Local development can use SQLite without Cloudflare services
The system SHALL retain a local SQLite storage mode for development and tests.

#### Scenario: Durable bindings are absent locally
- **WHEN** the application starts without durable storage configuration
- **THEN** repository operations use the configured local SQLite database path

#### Scenario: Tests run without Cloudflare resources
- **WHEN** the automated test suite runs in CI
- **THEN** storage tests can initialize and exercise the local SQLite adapter without D1 or R2 credentials

### Requirement: Storage migrations are explicit
The system SHALL manage durable storage schema changes through committed migration files or equivalent explicit migration steps.

#### Scenario: D1 schema can be initialized
- **WHEN** an operator provisions a new production durable database
- **THEN** committed migrations create the tables and indexes required by run history, site results, proposals, targets, outreach logs, HIL, and payment state

#### Scenario: Deployment applies migrations before application rollout
- **WHEN** GitHub Actions deploys production
- **THEN** durable storage migrations run before the new Worker and Container version is deployed

### Requirement: Migration from ephemeral SQLite is documented
The system SHALL document how to export current SQLite operational data and import it into durable storage when preservation is required.

#### Scenario: Operator chooses to preserve existing data
- **WHEN** an operator needs to preserve rows from the current SQLite database before durable rollout
- **THEN** documented export and import steps are available

#### Scenario: Operator chooses a clean durable start
- **WHEN** an operator does not need existing ephemeral rows
- **THEN** the durable rollout can start with an empty durable database without blocking deployment
