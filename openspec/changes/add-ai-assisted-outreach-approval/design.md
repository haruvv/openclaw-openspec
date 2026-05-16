## Context

Production SEO営業 already separates analysis from side effects. A run produces crawl findings, an LLM revenue audit, proposal artifacts, and contact candidates. The admin UI then lets an operator edit and send outreach, and separately create or email a Stripe Payment Link.

This is safe but operationally heavy. The application already has enough structured run data to pre-fill most choices, but the UI currently presents them as a manual form instead of a reviewable recommendation. The next step is to turn the existing draft into an AI-assisted approval package.

## Goals / Non-Goals

**Goals:**
- Present a review package that includes recipient, subject, body, priority, recommended amount, decision rationale, and caveats.
- Make the normal path one click: "承認して営業メール送信".
- Preserve manual editing before approval.
- Keep all external sends behind existing side-effect policies and SendGrid configuration.
- Keep Payment Link creation as a separate explicit action until reply detection exists.

**Non-Goals:**
- Automatic first-contact sending without human approval.
- Automatic Payment Link sending based only on analysis completion.
- Inbound reply detection or Gmail/SendGrid Inbound Parse integration.
- New LLM provider calls. This change uses the already persisted LLM revenue audit and conservative deterministic fallbacks.
- New database tables. Existing sales action tables are sufficient.

## Decisions

### Decision 1: Extend the outreach draft response rather than adding a second queue

`GET /api/admin/seo-sales/runs/:id/outreach-draft` will return the current editable fields plus an `approval` object. The UI can therefore render a recommendation summary without introducing another queue table or lifecycle.

Alternative considered: create a new `sales_approval_queue` table. Rejected for this iteration because approval state can be inferred from run completion plus absence/presence of sent outreach records, and adding another state table would create duplicate lifecycle management.

### Decision 2: Use persisted LLM audit as the AI decision source

The approval package will derive:
- priority from `llmRevenueAudit.salesPriority`
- rationale from business impact, recommended offer, and top findings
- amount from the recommended offer price range when parseable, otherwise the existing conservative default
- caveats from `llmRevenueAudit.caveats`

Fallbacks remain deterministic when the audit is missing.

Alternative considered: call the LLM again when the admin opens the page. Rejected because the run already contains the model output and a fresh call would add cost, latency, and inconsistency.

### Decision 3: Approval sends the reviewed draft through the existing send API

The new primary button will call the existing `POST /api/admin/seo-sales/runs/:id/outreach/send` with the recommended or edited values. Server-side validation, duplicate prevention, policy checks, and SendGrid sending remain unchanged.

Alternative considered: add a new approve endpoint. Rejected because the current endpoint already means "human reviewed this draft and send it"; changing the UI language and response contract is enough.

### Decision 4: Keep Payment Link separate in the UI

The approval summary may show a recommended amount, and the Payment Link amount field can default from it. The first-contact approval will not create or send a Payment Link.

Alternative considered: include Payment Link creation in the same approval. Rejected because no reply/interest detection exists yet and the product should avoid sending a payment request before the prospect signals interest.

## Risks / Trade-offs

- [Risk] The AI-selected recipient may be a generic mailbox. -> Show the recipient source and keep the field editable.
- [Risk] The operator may trust an imperfect draft too quickly. -> Show rationale and caveats next to the approval button.
- [Risk] Recommended amount parsing from natural text may be wrong. -> Use conservative parsing rules and allow manual amount override.
- [Risk] The wording "AI" may imply autonomous sending. -> UI copy must make clear that the admin is approving the send.
- [Risk] Duplicate prevention can still block a one-click send. -> Keep the existing server error visible and preserve sales action history.

## Migration Plan

1. Extend TypeScript types for `SalesOutreachDraft` with an approval recommendation object.
2. Populate the approval object in `buildOutreachDraft()`.
3. Update the admin run detail UI to show the recommendation summary and primary approval button.
4. Default the Payment Link amount from the recommendation.
5. Update tests for the new one-click approval request shape and Japanese UI labels.
6. Deploy with existing side-effect policies unchanged.

Rollback: revert the UI and draft response changes. No storage migration is required.
