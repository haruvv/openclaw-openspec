## ADDED Requirements

### Requirement: Admins can review an outreach draft before sending
The system SHALL provide an admin-only review flow for each completed SEO営業 run that has a target URL, research result, and proposal artifact. The review flow SHALL show the target URL, domain, recipient email, subject, email body, LLM営業評価, proposal content, and caveats before any email is sent.

#### Scenario: Draft is built from LLM営業評価
- **WHEN** an admin opens the outreach review for a completed run with `summary.llmRevenueAudit`
- **THEN** the draft subject and body are prefilled from `summary.llmRevenueAudit.outreach`
- **AND** no email is sent until the admin explicitly confirms the send action

#### Scenario: Recipient email is missing
- **WHEN** the run does not contain a crawled public email address
- **THEN** the review flow requires the admin to enter a recipient email before the send action is available
- **AND** the system does not submit inquiry forms automatically

### Requirement: Admins can send reviewed outreach email
The system SHALL send outreach email only after an authenticated admin confirms a reviewed draft. The server SHALL validate side-effect policy, SendGrid configuration, recipient email, duplicate cooldown, subject, and body before calling SendGrid.

#### Scenario: Reviewed email is sent
- **WHEN** an admin confirms a valid outreach draft and email side effects are allowed
- **THEN** the system sends the email to the reviewed recipient through SendGrid
- **AND** the system records the sent email metadata in durable storage

#### Scenario: Email side effects are disabled
- **WHEN** an admin confirms a draft while email side effects are disabled
- **THEN** the system rejects the send request with a clear policy error
- **AND** no SendGrid request is made

### Requirement: Admins can create a Payment Link after separate confirmation
The system SHALL provide a separate admin action to create a Stripe Payment Link for a reviewed prospect. The system SHALL NOT create a Payment Link as part of the first outreach email send.

#### Scenario: Payment Link is created after admin confirmation
- **WHEN** an admin confirms Payment Link creation for a run or sent outreach record and payment side effects are allowed
- **THEN** the system creates a Stripe Payment Link with the reviewed amount
- **AND** the system stores the link URL, Stripe IDs, amount, status, and expiration in durable storage

#### Scenario: Payment Link is not created on first outreach
- **WHEN** an admin sends the first outreach email
- **THEN** the system does not create a Stripe Payment Link unless the admin separately confirms Payment Link creation

### Requirement: Admin UI shows sales action state
The system SHALL show outreach and payment link state in the admin UI for run details and URL-oriented pages.

#### Scenario: Run has a sent outreach email
- **WHEN** an admin opens a run detail whose outreach email was sent
- **THEN** the UI shows recipient, subject, sent time, and send status

#### Scenario: Run has a Payment Link
- **WHEN** an admin opens a run detail with a created Payment Link
- **THEN** the UI shows amount, link URL, expiration, and status
