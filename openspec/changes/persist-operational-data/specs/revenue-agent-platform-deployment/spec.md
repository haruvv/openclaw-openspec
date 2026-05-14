## ADDED Requirements

### Requirement: Production deployment uses durable operational storage
The production deployment SHALL configure durable storage bindings for operational records and generated artifact bodies.

#### Scenario: Durable relational store is configured
- **WHEN** production deployment configuration is reviewed
- **THEN** a durable relational store binding or equivalent production database configuration is present for operational records

#### Scenario: Durable artifact store is configured
- **WHEN** production deployment configuration is reviewed
- **THEN** a durable object store binding or equivalent production object storage configuration is present for generated artifact bodies

#### Scenario: Container-local SQLite is not production source of truth
- **WHEN** production uses Cloudflare Containers
- **THEN** the Container-local SQLite file is not the source of truth for admin-visible operational history

### Requirement: Production deployment verifies durable reads after deploy
The production deployment SHALL include a smoke check that proves admin-visible data can be read from durable storage after deployment.

#### Scenario: Durable smoke check succeeds
- **WHEN** GitHub Actions completes a production deployment
- **THEN** the post-deploy smoke checks verify the production service can read required durable storage paths
