# openclaw-revenue-agent-integration Specification

## Purpose

OpenClawからRevenueAgentPlatformのSEO評価・提案生成パイプラインを、1つの高水準ビジネスアクションとして安全に呼び出すための統合契約を提供する。

## Requirements
### Requirement: OpenClaw-facing revenue agent run
The system SHALL expose a single OpenClaw-facing run capability that accepts one target URL and executes the RevenueAgentPlatform pipeline as one business action.

#### Scenario: Run request with default dry-run behavior
- **WHEN** OpenClaw invokes the run capability with a valid URL and no side-effect flags
- **THEN** the system SHALL crawl and score the URL, generate a proposal when eligible, and skip email, Telegram, and Stripe side effects

#### Scenario: Invalid URL request
- **WHEN** OpenClaw invokes the run capability with an invalid URL
- **THEN** the system SHALL reject the request with a structured validation error before calling external providers

### Requirement: Explicit side-effect controls
The system SHALL require explicit request-level controls before sending email, sending Telegram notifications, or creating Stripe Payment Links.

#### Scenario: Side effects disabled
- **WHEN** a run request sets `sendEmail`, `sendTelegram`, and `createPaymentLink` to false
- **THEN** the system SHALL not send email, send Telegram messages, or create Stripe Payment Links

#### Scenario: Side effects enabled
- **WHEN** a run request explicitly enables one or more side-effect flags
- **THEN** the system SHALL execute only the enabled side-effect steps after the crawl and proposal steps produce a target

### Requirement: Structured run result
The system SHALL return a structured JSON result that OpenClaw can summarize without parsing logs.

#### Scenario: Successful run
- **WHEN** the pipeline completes successfully
- **THEN** the result SHALL include run status, target URL, per-step statuses, proposal path when generated, SEO score when available, and any user-facing Payment Link URL when created

#### Scenario: Partial run
- **WHEN** one step fails or is skipped
- **THEN** the result SHALL include the step status and sanitized reason while preserving completed step outputs

### Requirement: Secret-safe responses
The system SHALL NOT include API keys, bearer tokens, webhook secrets, provider raw authorization headers, or `.env` contents in run responses.

#### Scenario: Provider failure
- **WHEN** an external provider returns an error
- **THEN** the system SHALL return a sanitized error message that does not expose secret values

### Requirement: Authenticated integration endpoint
The system SHALL protect any HTTP endpoint intended for OpenClaw invocation with an integration secret.

#### Scenario: Missing integration token
- **WHEN** a request reaches the OpenClaw-facing HTTP endpoint without the expected bearer token
- **THEN** the system SHALL reject the request without running pipeline steps

#### Scenario: Valid integration token
- **WHEN** a request reaches the OpenClaw-facing HTTP endpoint with the expected bearer token
- **THEN** the system SHALL validate the request body and run the requested pipeline action

### Requirement: OpenClaw skill contract documentation
The system SHALL document the OpenClaw skill name, request fields, response fields, required environment variables, and recommended default side-effect policy.

#### Scenario: Developer configures OpenClaw skill
- **WHEN** a developer reads the integration documentation
- **THEN** they SHALL be able to create or update an `openclaw-gateway` skill that invokes the RevenueAgentPlatform run capability
