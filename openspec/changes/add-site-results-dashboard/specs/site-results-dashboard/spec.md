## ADDED Requirements

### Requirement: Persist Site Analysis Results
The system SHALL persist a site-centric record whenever a RevenueAgent run produces an analyzed target, including the normalized target URL, domain, latest status, latest score, latest run reference, and update timestamp.

#### Scenario: Completed run produces target
- **WHEN** RevenueAgent completes after crawling and scoring a target URL
- **THEN** the system persists or updates the analyzed site record for that normalized URL
- **AND** the site record references the latest run and latest score

#### Scenario: Run does not produce target
- **WHEN** RevenueAgent completes without a crawled target
- **THEN** the system does not create a site result record

### Requirement: Record Site Snapshots
The system SHALL create a historical snapshot for each RevenueAgent run that produces an analyzed target, preserving status, score, diagnostics, summary metadata, and run reference.

#### Scenario: Multiple runs analyze same URL
- **WHEN** the same normalized URL is analyzed multiple times
- **THEN** the site detail history lists each snapshot in newest-first order

### Requirement: Record Site Proposals
The system SHALL associate generated proposal artifacts with the analyzed site and snapshot that produced them.

#### Scenario: Proposal generated for site
- **WHEN** a RevenueAgent run generates a proposal artifact for a site
- **THEN** the site detail page can display the latest proposal content and metadata

#### Scenario: Proposal skipped for site
- **WHEN** a RevenueAgent run analyzes a site but skips proposal generation
- **THEN** the site result remains visible without proposal content

### Requirement: Provide Site Results Dashboard
The system SHALL provide an authenticated `/sites` dashboard listing analyzed sites with latest status, target URL, domain, score, latest run, and update timestamp.

#### Scenario: User opens results dashboard
- **WHEN** an authorized user opens `/sites`
- **THEN** the system displays the analyzed site list independent of the `/admin` run list

#### Scenario: No sites analyzed yet
- **WHEN** an authorized user opens `/sites` before any site results exist
- **THEN** the system displays an empty state instead of an error

### Requirement: Provide Site Detail Page
The system SHALL provide an authenticated site detail page showing latest result summary, latest proposal content when available, snapshot history, and links to related run details.

#### Scenario: User opens site detail
- **WHEN** an authorized user opens a known site detail URL
- **THEN** the system displays the latest result and historical snapshots for that site

#### Scenario: User opens missing site detail
- **WHEN** an authorized user opens a site detail URL for an unknown site
- **THEN** the system responds with a not found page

### Requirement: Protect Site Results
The system SHALL protect `/sites` routes with the same admin token policy used by `/admin`.

#### Scenario: Production request without admin token
- **WHEN** a production request opens `/sites` without a valid admin token
- **THEN** the system denies access or prompts for the admin token

#### Scenario: Production request with admin token
- **WHEN** a production request opens `/sites` with a valid admin token
- **THEN** the system grants access and stores the admin session cookie
