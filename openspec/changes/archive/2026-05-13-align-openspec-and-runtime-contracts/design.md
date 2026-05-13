## Context

The repository has an implemented SEO outreach pipeline, but its OpenSpec source of truth is not currently valid: archived change deltas appear to have been copied into `openspec/specs/**/spec.md` without converting them to canonical spec format. Runtime integration has also drifted: `mcp-config.json` lists tool names and LLM environment variables that no longer match the MCP server or the Gemini/Z.ai provider.

The code already has most pipeline modules, so this change should stabilize contracts rather than introduce a new subsystem.

## Goals / Non-Goals

**Goals:**

- Make `openspec validate --all` pass.
- Keep existing functional requirements while converting canonical specs to `## Purpose` / `## Requirements`.
- Align MCP configuration with implemented MCP tools and current LLM provider environment variables.
- Ensure successful outreach progresses into HIL notification state instead of leaving HIL as an unused helper.
- Persist Payment Link expiration and reminder timestamps so reminder behavior is auditable and not coupled to generic `updated_at`.

**Non-Goals:**

- Build a production inbound email or link-click tracking integration.
- Change external providers or add new dependencies.
- Rework pricing, proposal content, or crawl scoring heuristics.

## Decisions

### Normalize specs in-place

Convert each canonical spec file under `openspec/specs` to valid OpenSpec format. This is preferable to creating replacement specs because the capability names are already correct and archived changes can remain as history.

### Make MCP config follow implementation names

The implementation exposes coarse-grained pipeline tools (`crawl_sites`, `generate_proposals`, `queue_outreach`, `send_outreach`, `create_payment_links`, `get_pipeline_status`). The config should use those names rather than listing finer-grained conceptual steps that do not exist as MCP tools. This keeps the agent loop executable.

### Treat HIL as post-outreach interest approval for the current MVP

The existing product flow sends an initial SEO proposal and then asks a human to approve the next step before sending a Payment Link. The implementation will therefore make successful outreach trigger HIL notification and `hil_pending` state. Full inbound email/click detection remains out of scope for this change, but the spec will explicitly leave that trigger contract testable.

### Add explicit Payment Link lifecycle fields

Add `payment_link_expires_at` and `payment_reminder_sent_at` to the target record. The reminder job will select links whose expiration is within the reminder window and have not already been reminded. This avoids duplicate reminders and makes the 30-day expiration requirement observable.

## Risks / Trade-offs

- Spec normalization could accidentally change requirement meaning → keep requirement text and scenarios semantically equivalent, only changing format unless a capability is explicitly modified.
- HIL semantics are still MVP-level and do not implement real inbound monitoring → document the current trigger clearly and leave future inbound tracking as a separate change.
- SQLite schema changes need to work for existing local databases → use additive columns with idempotent `ALTER TABLE` guarded by existing-column checks.
