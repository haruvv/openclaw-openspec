## 1. LLM Decision Core

- [x] 1.1 Add stock multi-agent LLM prompt and response parser.
- [x] 1.2 Add runner mode selection for `auto`, `llm`, and `deterministic`.
- [x] 1.3 Add portfolio and position context to LLM decision input.
- [x] 1.4 Preserve deterministic fallback for unavailable or invalid LLM output.

## 2. Safety Integration

- [x] 2.1 Enforce Risk Manager veto in code.
- [x] 2.2 Reuse existing confidence, ledger, and paper-only execution gates.
- [x] 2.3 Ensure LLM decisions never call broker mutation APIs.

## 3. Verification

- [x] 3.1 Add tests for LLM-backed BUY decision persistence.
- [x] 3.2 Add tests for Risk Manager veto blocking paper execution.
- [x] 3.3 Add tests for invalid LLM output deterministic fallback.
- [x] 3.4 Run `openspec validate add-stock-llm-agent-runner --strict`.
- [x] 3.5 Run `npm test`.
- [x] 3.6 Run `npm run build`.
