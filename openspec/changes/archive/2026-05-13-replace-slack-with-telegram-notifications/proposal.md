## Why

The current notification path depends on Slack, but the operator wants to use Telegram instead. Replacing Slack with Telegram reduces setup friction and keeps HIL/payment/smoke notifications aligned with the preferred messaging channel.

## What Changes

- Replace Slack notification delivery with Telegram Bot API delivery.
- Rename notification environment variables from `SLACK_*` to `TELEGRAM_*`.
- Update HIL approval, HIL timeout reminders, Payment Link sent notifications, payment completion notifications, and smoke notification validation to use Telegram.
- Remove active Slack references from runtime code, current specs, configuration, tests, and environment examples.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `hil-approval-flow`: HIL notifications and reminders are delivered via Telegram.
- `stripe-payment-link`: Payment Link and payment completion notifications are delivered via Telegram.
- `e2e-smoke-validation`: Side-effecting notification smoke step uses Telegram.

## Impact

- Runtime notification modules under `src/hil-approval-flow`, `src/stripe-payment-link`, and `src/smoke`.
- Configuration files `.env.example` and `mcp-config.json`.
- Tests that mock notification delivery.
- Current OpenSpec specs for HIL, Payment Link, and E2E smoke validation.
