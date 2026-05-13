## 1. OpenSpec Normalization

- [x] 1.1 Convert all canonical specs under `openspec/specs` to `## Purpose` / `## Requirements` format.
- [x] 1.2 Preserve existing requirement names and scenarios while applying the HIL, outreach, LLM, and Payment Link contract clarifications.
- [x] 1.3 Run `openspec validate --all` and fix any spec formatting or delta issues.

## 2. Runtime Contract Alignment

- [x] 2.1 Update `mcp-config.json` so tool names match the tools implemented by `src/mcp-server.ts`.
- [x] 2.2 Update `mcp-config.json` environment variables to pass Gemini/Z.ai and current provider credentials.
- [x] 2.3 Ensure MCP status output includes the states used by the updated HIL and Payment Link flow.

## 3. HIL Pipeline Integration

- [x] 3.1 Update the send step so successful outreach creates a HIL token, sends HIL notification, and stores `hil_pending` state.
- [x] 3.2 Keep skipped, duplicate, and daily-limit targets in appropriate states without accidentally triggering HIL.
- [x] 3.3 Add or update tests for successful send-to-HIL progression.

## 4. Payment Link Lifecycle State

- [x] 4.1 Add idempotent SQLite schema migration for `payment_link_expires_at` and `payment_reminder_sent_at`.
- [x] 4.2 Persist Payment Link expiration when links are created.
- [x] 4.3 Update reminder selection to use persisted expiration and reminder timestamps.
- [x] 4.4 Add or update tests for expiration persistence and one-time reminder behavior.

## 5. Verification

- [x] 5.1 Run `npm test`.
- [x] 5.2 Run `npm run build`.
- [x] 5.3 Run `openspec validate --all`.
- [x] 5.4 Review `git diff` to confirm only intended contracts and implementation files changed.
