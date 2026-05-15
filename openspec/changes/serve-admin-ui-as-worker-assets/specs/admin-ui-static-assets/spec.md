## ADDED Requirements

### Requirement: Admin UI is served as Worker static assets
The system SHALL serve the built admin UI HTML, JavaScript, CSS, and other static files from the Cloudflare Worker static asset layer rather than the RevenueAgent Container.

#### Scenario: Admin asset request does not require Container routing
- **WHEN** a client requests `/admin/assets/<asset-file>` in production
- **THEN** the Worker serves the asset from the uploaded admin UI asset bundle
- **AND** the request is not forwarded to the RevenueAgent Container

#### Scenario: Admin SPA route returns the frontend shell
- **WHEN** a client requests `/admin`, `/admin/seo-sales`, or another admin frontend route in production
- **THEN** the Worker serves the admin UI SPA shell from static assets

### Requirement: Admin API remains Container-backed
The system SHALL keep admin API requests on the existing RevenueAgent Container route so authentication, storage access, and operational logic remain unchanged.

#### Scenario: Admin API request is forwarded to Container
- **WHEN** a client requests `/api/admin/apps`
- **THEN** the Worker forwards the request to the RevenueAgent Container
- **AND** the Container applies the existing admin API authentication boundary

### Requirement: UI-only changes avoid Container rollout dependency
The deployment SHALL make admin UI static asset availability independent from RevenueAgent Container image rollout.

#### Scenario: New Vite asset hash is deployed
- **WHEN** a commit changes only the admin UI and produces a new Vite asset hash
- **THEN** the deployed Worker can serve the new asset without waiting for the Container image to become active

#### Scenario: Admin UI page view does not wake Container
- **WHEN** a user opens an admin frontend route without making API calls
- **THEN** the request can be completed by Worker static assets without starting the RevenueAgent Container
