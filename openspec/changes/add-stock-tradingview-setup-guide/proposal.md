## Why

The stock paper runner can already accept TradingView webhooks, but operators still need to know the exact production URL, auth header, JSON payload shape, and whether signals are arriving. Without an in-app setup guide, production configuration is error-prone and slow to verify.

## What Changes

- Add an admin TradingView setup guide for the stock trading app.
- Show the webhook URL derived from the current app origin.
- Show the required secret header name and configured/unconfigured state without exposing the secret value.
- Show a TradingView alert JSON template that matches the webhook parser.
- Show the latest received signal status/time so operators can confirm alerts are flowing.
- Keep this as UI/API visibility only; no real trading or broker behavior changes.

## Capabilities

### New Capabilities
- `stock-tradingview-setup-guide`: Provides operator-facing setup instructions and verification status for TradingView webhook alerts.

### Modified Capabilities
None.

## Impact

- Extends stock trading settings API response with latest signal metadata.
- Updates stock trading settings UI and types.
- Adds UI/API tests for setup guide visibility and secret redaction.
