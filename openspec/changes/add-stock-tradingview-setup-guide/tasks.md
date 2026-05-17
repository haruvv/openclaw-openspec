## 1. API Contract

- [x] 1.1 Add latest TradingView signal metadata to stock trading settings API.
- [x] 1.2 Keep secret values redacted from settings responses.

## 2. Admin UI

- [x] 2.1 Add TradingView setup guide panel to stock trading settings.
- [x] 2.2 Render current-origin webhook URL, auth header name, and readiness state.
- [x] 2.3 Render compatible alert JSON template.
- [x] 2.4 Render latest signal verification or empty state.

## 3. Verification

- [x] 3.1 Add admin route tests for latest signal metadata and secret redaction.
- [x] 3.2 Add admin UI tests for webhook URL, alert template, and latest signal state.
- [x] 3.3 Run `openspec validate add-stock-tradingview-setup-guide --strict`.
- [x] 3.4 Run `npm test`.
- [x] 3.5 Run `npm run build`.
