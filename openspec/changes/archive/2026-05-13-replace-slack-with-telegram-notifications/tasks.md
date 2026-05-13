## 1. OpenSpec Artifacts

- [x] 1.1 Create proposal, design, and delta specs for Telegram notification replacement.
- [x] 1.2 Validate the change with `openspec validate replace-slack-with-telegram-notifications`.

## 2. Runtime Notification Replacement

- [x] 2.1 Replace the HIL Slack notifier module with a Telegram notifier module.
- [x] 2.2 Update HIL timeout watcher and pipeline imports to use the Telegram notifier.
- [x] 2.3 Replace Payment Link sent and payment completion Slack calls with Telegram calls.
- [x] 2.4 Replace smoke Slack validation with Telegram validation.

## 3. Configuration and Specs

- [x] 3.1 Replace active `SLACK_*` variables with `TELEGRAM_*` in `.env.example` and `mcp-config.json`.
- [x] 3.2 Replace `SMOKE_SEND_SLACK` with `SMOKE_SEND_TELEGRAM`.
- [x] 3.3 Update current canonical specs to reference Telegram instead of Slack.

## 4. Tests

- [x] 4.1 Update tests and mocks from Slack notifier path to Telegram notifier path.
- [x] 4.2 Add or update tests for Telegram smoke skip behavior.

## 5. Verification

- [x] 5.1 Run `npm test`.
- [x] 5.2 Run `npm run build`.
- [x] 5.3 Run `openspec validate --all`.
- [x] 5.4 Confirm active runtime/config/spec files no longer reference Slack.
- [x] 5.5 Review `git diff` for intended scope.
