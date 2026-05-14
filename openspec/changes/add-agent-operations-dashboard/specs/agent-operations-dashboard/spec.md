## ADDED Requirements

### Requirement: Persist Agent Runs
The system SHALL persist agent run records using a generic model that supports RevenueAgent and future agent types.

#### Scenario: RevenueAgent run completes
- **WHEN** RevenueAgent completes from API, Telegram, or manual admin execution
- **THEN** the system stores the run id, agent type, source, status, input, summary, started time, completed time, and sanitized error state

#### Scenario: RevenueAgent run starts
- **WHEN** RevenueAgent begins execution
- **THEN** the system stores a running run record before long-running work begins

### Requirement: Persist Agent Steps
The system SHALL persist step-level outcomes for every recorded agent run.

#### Scenario: Steps are recorded
- **WHEN** a run report includes step results
- **THEN** the system stores each step name, status, duration, reason, error, and details as structured data linked to the run

### Requirement: Persist Agent Artifacts
The system SHALL persist references or content for artifacts produced by agent runs.

#### Scenario: Proposal is generated
- **WHEN** RevenueAgent generates a proposal artifact
- **THEN** the system stores a proposal artifact linked to the run with type, label, path or URL, content when available, and metadata

### Requirement: View Run List
The system SHALL provide an admin run list that allows operators to inspect recent agent runs.

#### Scenario: Operator opens run list
- **WHEN** an operator visits the admin dashboard
- **THEN** the system displays recent runs with agent type, source, target summary, status, started time, completed time, duration, and error summary

### Requirement: View Run Detail
The system SHALL provide an admin run detail view for each persisted agent run.

#### Scenario: Operator opens run detail
- **WHEN** an operator opens a run detail page
- **THEN** the system displays run metadata, input, summary, step outcomes, errors, and artifacts linked to that run

### Requirement: View Integration Status
The system SHALL provide an admin integration status view without exposing secret values.

#### Scenario: Operator opens integration status
- **WHEN** an operator opens the integrations area
- **THEN** the system displays configured or missing status for Firecrawl, Gemini, Z.ai, SendGrid, Telegram, Stripe, and key RevenueAgent policy flags without showing secret contents

### Requirement: Execute Manual RevenueAgent Run
The system SHALL allow an operator to start a manual RevenueAgent run from the admin dashboard.

#### Scenario: Operator submits a URL
- **WHEN** an operator submits a valid URL from the admin dashboard
- **THEN** the system runs RevenueAgent with source `manual`, persists the run, and redirects to the run detail view

### Requirement: Retry Existing Run
The system SHALL allow an operator to retry a recorded RevenueAgent run using its original input.

#### Scenario: Operator retries a run
- **WHEN** an operator clicks retry for a RevenueAgent run with a target URL
- **THEN** the system starts a new manual run using that URL and links the new run through persisted metadata

### Requirement: Avoid Secret Exposure
The system SHALL prevent secret values from appearing in admin dashboard views or persisted error text.

#### Scenario: Secret-backed integration is configured
- **WHEN** the admin dashboard displays provider status
- **THEN** the system displays only configured or missing state and does not render API keys, tokens, or secret values
