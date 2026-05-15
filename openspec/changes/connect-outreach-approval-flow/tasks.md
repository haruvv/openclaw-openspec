## 1. Durable Sales Data

- [x] 1.1 Add D1 migration for `sales_outreach_messages` and `sales_payment_links` with indexes for `run_id`, `site_id`, `domain`, `status`, and sent/created timestamps.
- [x] 1.2 Add TypeScript storage types for outreach messages, outreach draft inputs, payment link records, and sales action statuses.
- [x] 1.3 Implement a durable-first sales repository for creating/loading outreach drafts, sent outreach records, duplicate checks, and payment link records.
- [x] 1.4 Preserve SQLite fallback for local development/tests where durable storage is not configured.

## 2. Outreach Email Flow

- [x] 2.1 Build outreach draft generation from run detail data, using `llmRevenueAudit.outreach` when available and conservative fallback copy otherwise.
- [x] 2.2 Add admin API to load an outreach draft for a run.
- [x] 2.3 Add admin API to send a reviewed outreach email after validating admin auth, recipient, subject, body, side-effect policy, SendGrid config, and duplicate cooldown.
- [x] 2.4 Record successful, skipped, and failed outreach attempts in durable storage.
- [x] 2.5 Keep existing smoke/test SendGrid behavior separate from production outreach and label it accordingly in step details.

## 3. Payment Link Flow

- [x] 3.1 Add admin API to create a Stripe Payment Link for a run or sent outreach record after explicit admin confirmation.
- [x] 3.2 Require payment side-effect policy and `STRIPE_SECRET_KEY` before calling Stripe.
- [x] 3.3 Store Stripe product, price, payment link ID, URL, amount, expiration, status, and errors in durable storage.
- [x] 3.4 Add optional payment-link email send after explicit admin confirmation and email side-effect policy validation.
- [x] 3.5 Update Stripe webhook handling to mark durable payment link records paid when matching metadata is received.

## 4. Admin UI

- [x] 4.1 Add sales action state to run detail API responses without breaking older runs.
- [x] 4.2 Add an outreach review panel to run details showing recipient, subject, body,営業評価, proposal context, caveats, and send status.
- [x] 4.3 Add recipient/subject/body editing with validation and a final confirmation before send.
- [x] 4.4 Add Payment Link creation UI with editable `amount_jpy`, explicit confirmation, and clear disabled states when policy/secrets are missing.
- [x] 4.5 Show sent outreach and Payment Link records on run detail and URL-oriented pages.

## 5. Human Approval and Safety

- [x] 5.1 Treat authenticated admin confirmation as HIL approval for outreach send and Payment Link creation.
- [x] 5.2 Ensure no first outreach send automatically creates a Payment Link.
- [x] 5.3 Ensure no inquiry form is submitted automatically; form copy remains draft-only.
- [x] 5.4 Enforce 30-day duplicate cooldown from durable sent outreach records.

## 6. Tests and Verification

- [x] 6.1 Add repository tests for durable and SQLite fallback sales records.
- [x] 6.2 Add admin route tests for draft loading, send validation, policy-disabled behavior, duplicate prevention, and Payment Link creation.
- [x] 6.3 Add admin UI tests for draft review, disabled send states, successful send state, and Payment Link display.
- [x] 6.4 Add Stripe webhook tests for durable payment link paid status.
- [x] 6.5 Run `npm run lint`, `npm run build`, and `npm test`.
- [ ] 6.6 After deployment, verify production with side effects disabled, then enable SendGrid/Stripe policies for one controlled test.
