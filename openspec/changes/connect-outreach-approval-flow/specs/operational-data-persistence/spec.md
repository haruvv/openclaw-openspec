## MODIFIED Requirements

### Requirement: Operational records persist outside the Container filesystem
The system SHALL store production operational records in durable storage outside the Cloudflare Container filesystem. Operational records SHALL include run history, site results, generated artifacts, outreach messages, human approval state, and payment link records.

#### Scenario: Run history survives Container replacement
- **WHEN** a production Container is replaced after a deploy or sleep cycle
- **THEN** previously completed agent runs remain visible through the admin run history

#### Scenario: Site results survive Container replacement
- **WHEN** a production Container is replaced after a deploy or sleep cycle
- **THEN** previously analyzed site records remain visible through the admin URL results pages

#### Scenario: Sales actions survive Container replacement
- **WHEN** a production Container is replaced after an outreach email or Payment Link is created
- **THEN** the outreach message and Payment Link records remain visible through the admin UI

### Requirement: Storage migrations are explicit
The system SHALL manage durable storage schema changes through committed migration files or equivalent explicit migration steps.

#### Scenario: D1 schema can be initialized
- **WHEN** an operator provisions a new production durable database
- **THEN** committed migrations create the tables and indexes required by run history, site results, proposals, outreach messages, human approval state, payment links, and payment state

#### Scenario: Deployment applies migrations before application rollout
- **WHEN** GitHub Actions deploys production
- **THEN** durable storage migrations run before the new Worker and Container version is deployed

## ADDED Requirements

### Requirement: Sales action records preserve admin API contracts
The system SHALL expose outreach and payment link records through admin APIs without changing the existing run and site response contracts in incompatible ways.

#### Scenario: Existing run details still load
- **WHEN** the admin dashboard requests a run detail for a run without sales action records
- **THEN** the response remains valid and the UI shows an empty sales action state

#### Scenario: Run details include sales actions
- **WHEN** the admin dashboard requests a run detail with outreach or payment link records
- **THEN** the response includes those records in additive fields
