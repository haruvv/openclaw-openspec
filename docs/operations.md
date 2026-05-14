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

Cloudflare Containers currently use ephemeral disk. The SQLite database at `DB_PATH` is therefore not durable in production. Treat the current database as operational cache only.

The durable path should be a separate change:

1. Move run/site records to an external durable store, preferably Cloudflare D1 for relational data.
2. Move proposal documents and large artifacts to R2.
3. Keep container-local SQLite only for transient execution state or local development.
4. Add an explicit export/import migration from existing SQLite rows before relying on production history.
