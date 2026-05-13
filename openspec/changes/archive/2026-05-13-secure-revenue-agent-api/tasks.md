## 1. Security Utilities

- [x] 1.1 Add a revenue-agent API security module for bearer-token validation, constant-time comparison, and sanitized unauthorized responses.
- [x] 1.2 Add target URL validation that rejects unsupported schemes, localhost names, raw unsafe IP ranges, and DNS results resolving to unsafe IP ranges.
- [x] 1.3 Add a rate-limit abstraction with an in-memory fixed-window fallback for local development.
- [x] 1.4 Add side-effect policy resolution from environment flags, defaulting email, Telegram, and Stripe actions to disabled.
- [x] 1.5 Add secret sanitization helpers for error messages, step errors, and log-safe values.

## 2. API Integration

- [x] 2.1 Apply bearer-token validation at the start of `POST /api/revenue-agent/run` before request parsing and pipeline execution.
- [x] 2.2 Apply rate limiting before URL validation and expensive pipeline work.
- [x] 2.3 Replace basic URL parsing with the unsafe-target URL validator.
- [x] 2.4 Apply side-effect policy when passing `sendEmail`, `sendTelegram`, and `createPaymentLink` into `runRevenueAgent`.
- [x] 2.5 Ensure failed provider steps and API errors use sanitized messages in responses.

## 3. Tests

- [x] 3.1 Add API tests for missing, invalid, and unconfigured bearer-token cases.
- [x] 3.2 Add rate-limit tests proving excess requests return `429` before pipeline execution.
- [x] 3.3 Add URL validation tests for unsupported schemes, localhost, private IPs, link-local metadata addresses, and DNS-resolved unsafe hosts.
- [x] 3.4 Add side-effect policy tests proving request flags alone do not enable SendGrid, Telegram, or Stripe actions.
- [x] 3.5 Add sanitization tests proving configured secrets do not appear in API responses or step errors.

## 4. Documentation and Verification

- [x] 4.1 Document Cloudflare production environment variables, rate-limit expectations, and default-disabled side-effect policy.
- [x] 4.2 Update `.env.example` with security-related revenue-agent API settings.
- [x] 4.3 Run `npm test`, `npm run typecheck`, and the local OpenClaw-to-RevenueAgent smoke path after implementation.
- [x] 4.4 Run `openspec validate secure-revenue-agent-api --strict` before marking the change ready for archive.
