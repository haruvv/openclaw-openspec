## ADDED Requirements

### Requirement: Production deployment separates admin UI assets from Container runtime
The production deployment SHALL publish the admin UI frontend through the Worker static asset mechanism while keeping runtime API and analysis work on the RevenueAgent Container.

#### Scenario: Deployment config includes admin UI assets
- **WHEN** production deployment configuration is reviewed
- **THEN** the Worker configuration identifies the built admin UI directory as a static asset source

#### Scenario: Container image no longer gates admin UI asset availability
- **WHEN** GitHub Actions completes the Worker deploy step for a UI-only change
- **THEN** the production smoke check can validate the new admin UI assets independently of Container image rollout

#### Scenario: Container-backed endpoints remain available
- **WHEN** production deployment serves admin UI from static assets
- **THEN** `/api/admin/*`, `/api/revenue-agent/run`, scheduled discovery, Telegram webhook, Stripe webhook, and HIL routes still reach the RevenueAgent Container
