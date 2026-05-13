## Context

Notifications are currently implemented with Slack-specific environment variables, API endpoints, and spec language. Telegram can cover the current needs with a simpler Bot API call: send a text message containing the target context and approval/rejection/payment URLs.

## Goals / Non-Goals

**Goals:**

- Remove active Slack runtime dependency and replace it with Telegram Bot API.
- Keep the existing `notifyHil` call shape so pipeline code stays stable.
- Keep email fallback for failed HIL notification delivery.
- Preserve smoke safety behavior: Telegram notification remains opt-in.

**Non-Goals:**

- Implement Telegram inline keyboards or callback-query handling.
- Preserve Slack backward compatibility.
- Rewrite archived historical OpenSpec changes or old docs.

## Decisions

### Use a Telegram notifier module with existing `notifyHil`

Replace `slack-notifier.ts` with `telegram-notifier.ts`, keeping `notifyHil(params)` exported. Call sites change imports only; the pipeline does not need to know the provider.

### Use text links first

Send approval/rejection URLs as plain text links. Inline keyboards are useful later, but plain links are enough for the current Express approval endpoints and easier to test.

### Standardize environment variables

Use:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SMOKE_SEND_TELEGRAM`

Remove active `SLACK_*` and `SMOKE_SEND_SLACK` references.

## Risks / Trade-offs

- Telegram chat IDs can be non-obvious for groups → document the variable name clearly and rely on smoke testing to validate it.
- Removing Slack compatibility is a breaking configuration change → update `.env.example`, `mcp-config.json`, and specs in the same change.
