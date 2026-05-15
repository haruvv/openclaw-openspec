## Context

Current production storage is already `durable-http`: the Worker exposes `/internal/storage/*`, D1 stores relational records, and R2 stores large artifacts. The admin SEO営業 flow writes `agent_runs`, `agent_run_steps`, `agent_artifacts`, `analyzed_sites`, `site_snapshots`, and `site_proposals`.

The current RevenueAgent run does not yet have a production outreach path:

- `runRevenueAgent()` produces research, LLM営業評価, and proposal artifacts.
- Admin manual runs always call `runManualRevenueAgent()` with `sendEmail=false`, `sendTelegram=false`, and `createPaymentLink=false`.
- `runRevenueAgent()` side-effect steps are smoke/test oriented. SendGrid sends to `SMOKE_EMAIL_TO` or the sender address, and Stripe creates `Smoke Test SEO Service` links.
- Older `pipeline/*`, `outreach-sender/*`, and `stripe-payment-link/*` contain business-flow concepts, but they are backed by the legacy `targets` table and local `getDb()` path rather than the admin run/site durable flow.

The new flow must connect the production admin results to human-reviewed sales actions without accidentally sending email or creating payment links automatically.

## Goals / Non-Goals

**Goals:**

- Add a D1/R2-backed sales action model linked to `agent_runs` and analyzed URLs.
- Let admins review and edit the first-contact email before sending.
- Send real outreach email only after explicit human approval and side-effect policy checks.
- Let admins create and optionally send Stripe Payment Links only after a separate explicit action.
- Persist outreach and payment link history so admins can see what was sent, when, to whom, and from which run.
- Keep smoke/test side-effect steps separate from production outreach.

**Non-Goals:**

- Automatically submit inquiry forms.
- Automatically create Payment Links immediately after analysis or first outreach.
- Automatically classify inbound replies.
- Replace SendGrid, Stripe, or Telegram providers.
- Build a full CRM. This change only adds the minimum sales-action trail needed for safe operation.

## Decisions

### Decision 1: Use admin-reviewed sales actions, not run-time side effects

The production path will add explicit admin APIs such as:

- `GET /api/admin/seo-sales/runs/:id/outreach-draft`
- `POST /api/admin/seo-sales/runs/:id/outreach/send`
- `POST /api/admin/seo-sales/runs/:id/payment-links`

These APIs operate after an analysis run exists. They do not run as automatic steps inside `runRevenueAgent()`.

Rationale: analysis and outreach have different risk profiles. Analysis can run automatically; external communication and payment links must require deliberate human action.

Alternative considered: enable `sendEmail=true` and `createPaymentLink=true` inside manual runs. Rejected because the current implementation is smoke-oriented and would blur analysis with irreversible side effects.

### Decision 2: First outreach and Payment Link are separate stages

The first outreach email is a polite free-diagnosis / reply-acquisition message. It must not include a Payment Link by default. Payment Link generation happens only after a separate admin action once the operator decides the prospect is ready.

Rationale: this matches the product strategy already documented: initial contact must not feel pushy or insulting, and immediate payment pressure is likely to reduce trust.

Alternative considered: create Payment Link after outreach send success via HIL. Rejected for MVP because outreach send success is not the same as purchase intent.

### Decision 3: Add durable sales tables instead of using legacy `targets`

Add D1 tables for production sales state:

- `sales_outreach_messages`
  - `id`
  - `run_id`
  - `site_id`
  - `snapshot_id`
  - `target_url`
  - `domain`
  - `recipient_email`
  - `subject`
  - `body_text`
  - `status`: `draft`, `sent`, `skipped`, `failed`
  - `reviewed_at`
  - `sent_at`
  - `error`
  - `metadata_json`
  - `created_at`
  - `updated_at`
- `sales_payment_links`
  - `id`
  - `run_id`
  - `site_id`
  - `outreach_message_id`
  - `domain`
  - `recipient_email`
  - `amount_jpy`
  - `stripe_product_id`
  - `stripe_price_id`
  - `stripe_payment_link_id`
  - `payment_link_url`
  - `status`: `created`, `sent`, `failed`, `paid`
  - `expires_at`
  - `sent_at`
  - `error`
  - `metadata_json`
  - `created_at`
  - `updated_at`

Rationale: the admin app already uses durable run/site records as the source of truth. Extending that model is safer than reviving the old SQLite-only pipeline state.

Alternative considered: migrate the old `targets` table. Rejected because it duplicates run/site state and would keep two operational models alive.

### Decision 4: Build drafts from stored run data

Outreach draft defaults are built from the run detail:

- Recipient: crawled public email if available. If absent, admin must enter one manually.
- Subject: `llmRevenueAudit.outreach.subject` if present; otherwise a conservative fallback.
- Body: `llmRevenueAudit.outreach.firstEmail` if present; otherwise a conservative fallback.
- Context: show `営業評価`, `調査結果`, and proposal artifact next to the form.

Rationale: the LLM already creates cautious first-contact copy, but sending must remain human-controlled.

### Decision 5: Side-effect policy is still enforced

Even after the admin clicks send/create, the server must check:

- `sendEmail` policy for outreach email and payment-link email.
- `createPaymentLink` policy for Stripe link creation.
- Required secrets (`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `STRIPE_SECRET_KEY`).

If policy or secrets are missing, the API returns a clear error and records no external side effect.

### Decision 6: Duplicate prevention is domain-based and durable

The outreach send API must reject or skip sends to domains that have a `sent` outreach message within the cooldown window, defaulting to 30 days.

Rationale: duplicate prevention must survive container replacement and must apply across all admin sessions.

### Decision 7: Keep smoke steps but rename/label their purpose

Existing smoke side effects may remain for automated verification, but they must be clearly treated as smoke/test outputs and must not appear as the production sales send path in the UI.

## Risks / Trade-offs

- [Risk] Admin may send to the wrong email address. → Require editable recipient, show target URL/domain, and display a final confirmation before sending.
- [Risk] A public email address may not be the right decision maker. → Allow manual recipient override and keep form-only contact as draft-only.
- [Risk] Payment Link created too early. → Payment Link action is separate from first outreach and requires explicit admin confirmation.
- [Risk] Stripe links with wrong amount. → Store `amount_jpy` and make it editable before creation; default conservatively.
- [Risk] Duplicate send detection blocks legitimate re-contact. → Make cooldown visible and allow a future explicit override only after a separate change.
- [Risk] More D1 schema changes increase migration risk. → Add explicit migrations and test storage bridge behavior.

## Migration Plan

1. Add D1 migration for `sales_outreach_messages` and `sales_payment_links`.
2. Add repository APIs for outreach drafts, sent message records, duplicate checks, and payment link records.
3. Add admin APIs and UI without enabling automatic sends.
4. Deploy with side-effect policies still false.
5. Verify draft rendering and validation in production.
6. Configure SendGrid/Stripe secrets if missing.
7. Enable email policy, send one internal/test recipient through the production review UI.
8. Enable payment link policy and create one Stripe test-mode link from a reviewed run.

Rollback: disable side-effect policies first. The new tables can remain; existing analysis flows do not depend on them.

## Open Questions

- Initial default `amount_jpy`: use 50,000 JPY as today, or make a lower default such as 30,000 JPY?
- Payment Link email: send immediately after link creation, or create link first and let admin choose whether to email it?
- Should Telegram be notified after real outreach send, or only after Payment Link creation?
