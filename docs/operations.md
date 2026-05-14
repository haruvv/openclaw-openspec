# RevenueAgentPlatform Operations

## Deployment

Production is deployed by GitHub Actions.

- Trigger: push to `main`
- Workflow: `.github/workflows/deploy-production.yml`
- Checks: `npm ci`, `npm test`, `npm run build`
- Deploy command: `npm run deploy:cloudflare`
- Post-deploy smoke: `/health`, `/admin`, and the built admin CSS asset
- Runtime Node.js: 20, because `better-sqlite3@9.6.0` is currently validated on Node 20 in this project

Manual staging deploy is available from the `Deploy Staging` workflow. Staging uses the same build and tests, then deploys with a different Worker name.

## Required GitHub Secret

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Allows GitHub Actions to run `wrangler deploy` |

The Cloudflare account ID is fixed in the workflow. Runtime application secrets are not stored in GitHub; keep them in Cloudflare Worker secrets.

## Cloudflare Runtime Secrets

Required:

| Secret | Purpose |
| --- | --- |
| `REVENUE_AGENT_INTEGRATION_TOKEN` | Bearer token for protected API calls |
| `FIRECRAWL_API_KEY` | Crawl provider |
| `GEMINI_API_KEY` | Primary LLM provider |
| `ADMIN_TOKEN` | Admin portal access |

Optional:

| Secret | Purpose |
| --- | --- |
| `ZAI_API_KEY` | LLM fallback provider |
| `SENDGRID_API_KEY` | Email sending |
| `SENDGRID_FROM_EMAIL` | Verified sender address |
| `TELEGRAM_BOT_TOKEN` | Telegram bot |
| `TELEGRAM_CHAT_ID` | Allowed/default Telegram chat |
| `TELEGRAM_WEBHOOK_SECRET` | Telegram webhook verification |
| `STRIPE_SECRET_KEY` | Stripe payment links |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |

## Logs

Use these commands when production behavior is unclear:

```bash
gh run list --limit 5
gh run view <run-id> --log-failed
npx wrangler tail revenue-agent-platform --format pretty
npx wrangler containers list
npx wrangler containers instances a037f67b-f44e-4df2-982e-9a90d323736e
```

Do not paste secret values into issue comments, logs, or chat.

## Persistence

Cloudflare Containers currently use ephemeral disk. The SQLite database at `DB_PATH` is therefore not durable in production. Treat the current database as operational cache only until D1/R2 bindings are enabled.

Durable storage migration is tracked by OpenSpec change `persist-operational-data`.

### Clean durable start

Use this if current production history can be discarded.

1. Create a production D1 database and R2 bucket.
2. Add the D1/R2 binding IDs to `wrangler.jsonc`.
3. Apply migrations:

```bash
npx wrangler d1 migrations apply <database-name> --remote
```

4. Set `DURABLE_STORAGE_TOKEN` as a Cloudflare Worker secret.
5. Deploy production and run smoke checks.

### Preserve existing SQLite data

Use this if current production history must be retained before switching the source of truth.

1. Export the live Container SQLite file before replacing the Container:

```bash
npm run storage:export -- /tmp/revenue-agent/pipeline.db ./data/operational-export.sql
```

2. Apply the schema migration to the D1 database:

```bash
npx wrangler d1 migrations apply <database-name> --remote
```

3. Import exported rows:

```bash
npx wrangler d1 execute <database-name> --remote --file ./data/operational-export.sql
```

4. Deploy production with durable storage enabled.
5. Confirm the admin dashboard still shows the imported run/site history.

### Rollback

If durable storage rollout fails before data is trusted:

1. Export any D1-only rows that must be preserved with `wrangler d1 execute` queries.
2. Remove or unset `DURABLE_STORAGE_BASE_URL` and `DURABLE_STORAGE_TOKEN` from production configuration.
3. Redeploy the previous version or current version in SQLite mode.
4. Keep the D1/R2 resources intact until the missing rows are either imported back or explicitly discarded.

Rollback to SQLite mode restores service behavior, but it does not automatically copy D1-only writes back into the Container-local database.
