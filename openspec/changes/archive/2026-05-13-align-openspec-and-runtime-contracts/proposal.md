## Why

The current OpenSpec state cannot be validated because canonical specs still use delta-style headings, and several runtime contracts drifted from the documented agent configuration. This blocks reliable future changes because the source of truth is ambiguous: OpenSpec validation fails, MCP tool names disagree, and some pipeline requirements are not represented by durable runtime state.

## What Changes

- Normalize all existing canonical specs to valid OpenSpec format with `## Purpose` and `## Requirements`.
- Align MCP runtime tool names, environment variables, and `mcp-config.json` so the configured agent loop matches the server implementation.
- Clarify the HIL contract so outreach cannot bypass the intended approval path and HIL state transitions are observable through MCP/server flows.
- Make Payment Link expiration and reminder behavior durable instead of deriving it from generic `updated_at` timestamps.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `site-crawler`: Normalize canonical spec format without changing functional requirements.
- `proposal-generator`: Normalize canonical spec format without changing functional requirements.
- `outreach-sender`: Clarify the requirement that HIL notification is triggered as part of the send flow after successful outreach, and keep duplicate/limit behavior explicit.
- `hil-approval-flow`: Clarify HIL trigger/state behavior and normalize canonical spec format.
- `stripe-payment-link`: Require persisted Payment Link expiration/reminder state and normalize canonical spec format.
- `llm-provider`: Normalize canonical spec format and keep Gemini/Z.ai environment expectations explicit.

## Impact

- OpenSpec files under `openspec/specs/**/spec.md`.
- MCP configuration in `mcp-config.json`.
- Runtime contracts in `src/mcp-server.ts`, `src/pipeline/agent.ts`, `src/pipeline/state.ts`, `src/utils/db.ts`, and payment/HIL modules.
- Tests covering MCP/status behavior, HIL progression, and Payment Link reminder state.
