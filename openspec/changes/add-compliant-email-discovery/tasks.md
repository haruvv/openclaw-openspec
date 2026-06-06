## 1. Email Discovery Core

- [x] 1.1 Add provider-agnostic email discovery types and compliance decision results.
- [x] 1.2 Implement Hunter Domain Search client and parser.
- [x] 1.3 Implement optional Apollo People Search fallback client and parser.
- [x] 1.4 Implement business-email screening for personal domains, personal email types, role relevance, guessed/accept-all/verification confidence, and provider evidence.

## 2. Suppression And Site Policy

- [x] 2.1 Add persistent email/domain suppression storage and migration.
- [x] 2.2 Add suppression lookup helpers used by discovery and send-time validation.
- [x] 2.3 Detect explicit sales/no-solicitation language in crawled site content.

## 3. Pipeline Integration

- [x] 3.1 Integrate compliant email discovery after public contact-page extraction when no public email is available.
- [x] 3.2 Preserve existing non-email contact methods when external email discovery is skipped or fails.
- [x] 3.3 Update contact method ranking so low-confidence provider emails remain behind high-confidence public emails.

## 4. Send-Time Safeguards

- [x] 4.1 Block reviewed outreach to suppressed emails or domains before SendGrid is called.
- [x] 4.2 Enforce sender identity configuration and add transparent opt-out/footer text to reviewed outreach.
- [x] 4.3 Record skipped outreach when compliance validation blocks sending.

## 5. Verification

- [x] 5.1 Add unit tests for Hunter/Apollo parsing and email candidate screening.
- [x] 5.2 Add crawler tests for provider fallback, sales-prohibited sites, and provider failure behavior.
- [x] 5.3 Add sales service tests for suppression blocking and footer enforcement.
- [x] 5.4 Run OpenSpec validation, targeted tests, full tests, and server build.
