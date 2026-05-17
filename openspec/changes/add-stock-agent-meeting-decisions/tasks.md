## 1. Runner Agent Meeting

- [x] 1.1 Add canonical stock agent meeting list and normalization.
- [x] 1.2 Fill missing agent opinions for deterministic fallback decisions.
- [x] 1.3 Preserve LLM-provided agent opinions while filling missing canonical agents.
- [x] 1.4 Keep Risk Manager veto and paper-only gates intact.

## 2. Admin UI

- [x] 2.1 Update decision detail page to present an AI investment meeting.
- [x] 2.2 Show saved agent count and paper-only context.
- [x] 2.3 Ensure all canonical agent opinions are visible.

## 3. Verification

- [x] 3.1 Add runner tests for full deterministic agent meeting persistence.
- [x] 3.2 Add runner tests for partial LLM agent output completion.
- [x] 3.3 Add UI tests for full meeting visibility.
- [x] 3.4 Run `openspec validate add-stock-agent-meeting-decisions --strict`.
- [x] 3.5 Run `npm test`.
- [x] 3.6 Run `npm run build`.
