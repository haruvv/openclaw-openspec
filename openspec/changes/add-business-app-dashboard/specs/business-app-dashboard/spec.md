## ADDED Requirements

### Requirement: Admin Portal Lists Business Apps
The system SHALL provide an authenticated `/admin` portal that lists available business apps, including SEO sales as an active app and future apps as non-active placeholders when configured.

#### Scenario: Authorized user opens admin portal
- **WHEN** an authorized user opens `/admin`
- **THEN** the system displays a business app list
- **AND** the SEO sales app links to its app dashboard

#### Scenario: Unauthorized user opens admin portal
- **WHEN** a production request opens `/admin` without a valid admin token
- **THEN** the system denies access or prompts for the admin token

### Requirement: SEO Sales App Dashboard
The system SHALL provide an authenticated SEO sales app dashboard under `/admin/seo-sales` with links to URL results, execution logs, and external service settings.

#### Scenario: User opens SEO sales app
- **WHEN** an authorized user opens `/admin/seo-sales`
- **THEN** the system displays the SEO sales app home with navigation to its key screens

### Requirement: SEO Sales Canonical Routes
The system SHALL expose SEO sales URL results under `/admin/seo-sales/sites` and execution logs under `/admin/seo-sales/runs`.

#### Scenario: User opens SEO sales URL results
- **WHEN** an authorized user opens `/admin/seo-sales/sites`
- **THEN** the system displays URL-level SEO sales results

#### Scenario: User opens SEO sales execution logs
- **WHEN** an authorized user opens `/admin/seo-sales/runs`
- **THEN** the system displays SEO sales run history

### Requirement: Compatibility Redirects
The system SHALL redirect existing SEO sales admin URLs to the new canonical SEO sales paths.

#### Scenario: User opens legacy sites URL
- **WHEN** a user opens `/sites`
- **THEN** the system redirects to `/admin/seo-sales/sites`

#### Scenario: User opens legacy run detail URL
- **WHEN** a user opens `/admin/runs/{id}`
- **THEN** the system redirects to `/admin/seo-sales/runs/{id}`

#### Scenario: User opens legacy integrations URL
- **WHEN** a user opens `/admin/integrations`
- **THEN** the system redirects to `/admin/seo-sales/settings`
