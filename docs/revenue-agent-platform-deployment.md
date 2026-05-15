# RevenueAgentPlatform 本番デプロイ方針

このドキュメントは、RevenueAgentPlatform を OpenClaw から本番利用できるようにするためのデプロイ方針、初期コスト、環境変数、検証手順をまとめたものです。

## 推奨構成

初期本番は Cloudflare Containers を使います。

理由:

- RevenueAgentPlatform は Node/Express と Chromium/Lighthouse を使うため、通常の Workers だけではなくコンテナ実行が向いています。
- Cloudflare が TLS、公開ルーティング、Rate Limiting、DDoS 保護を担当できます。
- OpenClaw Gateway からは安定した HTTPS の `REVENUE_AGENT_BASE_URL` だけを見ればよく、ローカル環境や自宅マシンに依存しません。
- コンテナはリクエスト時に起動し、一定時間後に sleep させる運用にできるため、低頻度利用ではコストを抑えやすいです。

代替案として Cloudflare Tunnel + VPS/Node host も使えます。ただし、VPS の OS 更新、プロセス監視、Chrome 依存関係、再起動復旧をこちらで持つ必要があるため、最初の本番運用では Containers を優先します。

## コスト目安

Cloudflare Containers は Workers Paid plan 上で使います。2026-05-14 時点の公式料金では、Workers Paid は最低 $5/月で、Containers の一定利用枠が含まれます。

含有枠:

| 項目 | 含有枠 |
| --- | --- |
| Memory | 25 GiB-hours/month |
| CPU | 375 vCPU-minutes/month |
| Disk | 200 GB-hours/month |

超過料金:

| 項目 | 超過料金 |
| --- | --- |
| Memory | $0.0000025 / GiB-second |
| CPU | $0.000020 / vCPU-second |
| Disk | $0.00000007 / GB-second |

Network egress は地域ごとに含有枠と単価が異なります。たとえば North America / Europe は 1 TB/month が含まれ、超過は $0.025/GB です。Oceania / Korea / Taiwan は 500 GB/month が含まれ、超過は $0.05/GB です。

RevenueAgentPlatform の初期運用では、次のように見積もります。

| 利用状況 | 月額目安 |
| --- | --- |
| 手動検証、低頻度クロール | $5 前後 |
| 1 日数回のクロール | $5-$15 程度 |
| 毎日大量クロール、Lighthouse/Chromium 長時間実行 | $20-$50+ |

実コストに効く要素:

- クロール回数
- Lighthouse/Chromium の実行時間
- コンテナの instance type
- コンテナが sleep するまでの時間
- Firecrawl、LLM、SendGrid など Cloudflare 外の API 利用量

初期設定では、コンテナを常時起動にせず、短めの idle timeout で sleep させる方針にします。

## 外部サービス費用

Cloudflare 以外にも以下の費用が発生し得ます。

| サービス | 課金の考え方 |
| --- | --- |
| Firecrawl | 無料枠またはクレジット制。クロール量が増えると有料化しやすいです。 |
| Gemini / Z.ai / OpenAI など LLM | 基本は API 利用量に応じた従量課金です。Z.ai は残高または resource package が必要です。 |
| Telegram Bot API | Bot API 自体は基本無料です。 |
| SendGrid | 無料枠から開始できますが、送信量やプランで変わります。 |
| Stripe | 月額固定ではなく、主に決済手数料です。test mode は実課金されません。 |

各サービスの料金は変わるため、本番前に公式 pricing を確認してください。

## 初期本番設定

RevenueAgentPlatform 側:

```dotenv
NODE_ENV=production
PORT=3000
REVENUE_AGENT_INTEGRATION_TOKEN=<long-random-secret>
REVENUE_AGENT_RATE_LIMIT_PER_MINUTE=60
REVENUE_AGENT_ALLOW_EMAIL=false
REVENUE_AGENT_ALLOW_TELEGRAM=false
REVENUE_AGENT_ALLOW_PAYMENT_LINK=false
FIRECRAWL_API_KEY=<production-or-test-key>
GEMINI_API_KEY=<production-or-test-key>
GEMINI_MODEL=gemini-2.0-flash
ZAI_API_KEY=<optional>
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
ZAI_MODEL=glm-4.5-flash
```

副作用系は初回デプロイでは無効のままにします。

```dotenv
SENDGRID_API_KEY=<optional>
SENDGRID_FROM_EMAIL=<verified-sender>
SENDGRID_FROM_NAME=RevenueAgentPlatform
TELEGRAM_BOT_TOKEN=<optional>
TELEGRAM_CHAT_ID=<optional>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

OpenClaw Gateway 側:

```dotenv
REVENUE_AGENT_BASE_URL=https://<production-hostname>
REVENUE_AGENT_INTEGRATION_TOKEN=<same-long-random-secret>
```

`REVENUE_AGENT_INTEGRATION_TOKEN` は RevenueAgentPlatform と OpenClaw Gateway で同じ値にします。値は Git にコミットせず、Cloudflare secrets または hosting platform の secret store に登録します。

### Telegram 直結 Bot

初期運用では OpenClaw を挟まず、Telegram webhook から RevenueAgentPlatform Worker を直接呼びます。

```text
Telegram Bot
  -> POST /telegram/webhook
  -> RevenueAgentPlatform Worker
  -> RevenueAgentPlatform Container
  -> Telegram sendMessage
```

Worker は `secret_token` を検証して webhook request を Container へ転送します。Container は Telegram メッセージ本文から最初の `http` / `https` URL を抽出し、開始メッセージを即時返信したうえで、`sendEmail=false`、`sendTelegram=false`、`createPaymentLink=false` の副作用なしで RevenueAgentPlatform を実行します。結果は Telegram に要約返信します。

追加 secret:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

`TELEGRAM_CHAT_ID` はカンマ区切りで複数指定できます。未設定の場合は Telegram bot に届いた chat を許可します。`TELEGRAM_WEBHOOK_SECRET` は Telegram の `secret_token` として使い、`X-Telegram-Bot-Api-Secret-Token` header を検証します。

Webhook 設定:

```bash
curl -sS "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<production-hostname>/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "edited_message"],
    "drop_pending_updates": true
  }'
```

OpenClaw 連携は将来の拡張として残します。自然文 routing、複数 skill、cron、承認フロー、複数チャネル統合が必要になった段階で、OpenClaw Gateway から同じ `POST /api/revenue-agent/run` を呼ぶ構成に戻せます。

## Cloudflare 設定

初期本番で必要な Cloudflare 設定:

| 項目 | 方針 |
| --- | --- |
| Hosting | Cloudflare Containers |
| Hostname | 初期は `https://revenue-agent-platform.<workers-subdomain>.workers.dev` |
| TLS | Cloudflare managed HTTPS |
| Rate Limiting | Workers Rate Limiting binding で `POST /api/revenue-agent/run` を対象に設定 |
| Request filtering | 必要に応じて WAF / custom rules を追加 |
| Logs | Authorization header や API key を出さない |

Rate Limiting は Cloudflare 側を第一防衛線にし、アプリ側の `REVENUE_AGENT_RATE_LIMIT_PER_MINUTE` はローカル fallback として残します。

`wrangler.jsonc` では `REVENUE_AGENT_RUN_LIMITER` binding を設定し、`POST /api/revenue-agent/run` だけを client IP ごとに 60 秒 10 requests へ制限します。この制限は Worker wrapper で container に proxy する前に評価するため、無効 token や不正 request でも高コストな container 実行へ進みにくくなります。

`wrangler.jsonc` では `workers_dev=true` を明示し、初回は Cloudflare の workers.dev hostname を本番候補 URL として使います。独自ドメインを使う場合は、Cloudflare zone が決まった後で `routes` を追加します。

このリポジトリには Cloudflare Containers 用の最小構成を置きます。

| ファイル | 役割 |
| --- | --- |
| `wrangler.jsonc` | Worker、Container、Durable Object、初期 env の設定 |
| `worker/revenue-agent-container.ts` | Cloudflare Worker から singleton Container に proxy する wrapper |
| `Dockerfile` | RevenueAgentPlatform production image |
| `infra/cloudflare/revenue-agent-rate-limit.tf.example` | Cloudflare zone-level Rate Limiting rule の Terraform 例 |

`main` ブランチへ push すると、GitHub Actions の `Deploy Production` workflow が本番へ反映します。

Workflow は次の順で実行します。

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. `npm run deploy:cloudflare`

`npm run deploy:cloudflare` は `wrangler deploy --containers-rollout immediate` を実行します。デプロイ時は Wrangler が Worker code、Worker Static Assets、Container binding を Cloudflare に反映します。Container runtime に変更がある場合は `Dockerfile` から image を build/push します。

GitHub repository secrets には以下が必要です。

```text
CLOUDFLARE_API_TOKEN
```

`CLOUDFLARE_ACCOUNT_ID` は workflow に固定値として入れています。`CLOUDFLARE_API_TOKEN` には、この Worker と Container application を deploy できる権限を付与します。RevenueAgentPlatform の実行時 secret は GitHub Actions には置かず、Cloudflare 側の Worker secrets として管理します。

Container は `max_instances=2` にしています。通常運用は Worker version ごとの singleton 名に寄せますが、deploy / rollout 直後に旧 instance が停止するまでの間、起動上限で webhook が 500/503 になるのを避けるためです。

Worker には `version_metadata` binding を設定しています。Worker は version ID を使って Container instance 名を作るため、runtime 変更時は新しい container instance が起動します。

管理画面の静的ファイルは Container image ではなく Worker Static Assets から配信します。Vite build は `dist-assets/admin` に出力し、`wrangler.jsonc` の `assets.directory` は `./dist-assets` を指します。これにより、UI だけの変更は Container rollout を待たずに反映できます。

```bash
git push origin main
```

手元から緊急デプロイする場合だけ、以下を実行します。

```bash
npm run deploy:cloudflare
```

本番 secret は `wrangler secret put` で登録します。

```bash
npx wrangler secret put REVENUE_AGENT_INTEGRATION_TOKEN
npx wrangler secret put FIRECRAWL_API_KEY
npx wrangler secret put GEMINI_API_KEY
```

任意 provider を使う場合だけ、追加 secret を登録します。

```bash
npx wrangler secret put ZAI_API_KEY
npx wrangler secret put SENDGRID_API_KEY
npx wrangler secret put SENDGRID_FROM_EMAIL
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put ADMIN_TOKEN
```

### Admin portal

The management portal is served by Worker Static Assets under `/admin`. It lists business apps such as SEO営業 and planned future apps such as 株自動売買.

The admin UI is a React + Tailwind single-page app built into `dist-assets/admin` by `npm run build`. Worker Static Assets serves that bundle under `/admin`, while operational data is provided by JSON APIs under `/api/admin` and forwarded to the Container.

Production access requires `ADMIN_TOKEN`. Open the portal with:

```text
https://<production-hostname>/admin?token=<ADMIN_TOKEN>
```

The token is stored in browser session storage after the first request and is attached to `/api/admin/*` calls as a query parameter. The static shell itself does not contain secret values and does not edit secrets.

### SEO sales app

SEO営業 is the first active business app. Its canonical paths are:

```text
https://<production-hostname>/admin/seo-sales?token=<ADMIN_TOKEN>
https://<production-hostname>/admin/seo-sales/sites?token=<ADMIN_TOKEN>
https://<production-hostname>/admin/seo-sales/runs?token=<ADMIN_TOKEN>
https://<production-hostname>/admin/seo-sales/settings?token=<ADMIN_TOKEN>
```

Use `/admin/seo-sales/sites` for product-facing review of analyzed URLs: latest status, latest SEO score, latest proposal, snapshot history, and links back to related run details.

Use `/admin/seo-sales/runs` for operations work: failures, retries, raw steps, artifacts, and manual RevenueAgent run/retry actions.

```text
Legacy `/sites`, `/admin/runs`, and `/admin/integrations` URLs redirect to the SEO営業 canonical paths.
```

Each successful RevenueAgent run that produces a crawled target writes both the generic run log and the site result state. Runs that do not produce a target remain visible in `/admin/seo-sales/runs` but do not create a URL result record.

独自ドメイン移行後、zone-level Rate Limiting も追加したい場合は、example をコピーして `cloudflare_zone_id` と `revenue_agent_hostname` を設定します。初期値は `POST /api/revenue-agent/run` を IP ごとに 60 秒 10 requests まで許可し、超過時は 10 分 block します。

```bash
cp infra/cloudflare/revenue-agent-rate-limit.tf.example infra/cloudflare/revenue-agent-rate-limit.tf
```

Cloudflare Dashboard で設定する場合も同じ条件にします。

```text
Expression:
(http.host eq "<production-hostname>" and http.request.method eq "POST" and http.request.uri.path eq "/api/revenue-agent/run")

Characteristics:
cf.colo.id, ip.src

Period:
60 seconds

Requests per period:
10

Mitigation timeout:
600 seconds
```

## 初回検証

1. `GET /health` を確認します。workers.dev hostname の場合、URL は `https://revenue-agent-platform.<workers-subdomain>.workers.dev` です。

```bash
curl -sS https://<production-hostname>/health
```

2. 副作用なしで `POST /api/revenue-agent/run` を直接確認します。

```bash
curl -sS https://<production-hostname>/api/revenue-agent/run \
  -H "Authorization: Bearer <REVENUE_AGENT_INTEGRATION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "sendEmail": false,
    "sendTelegram": false,
    "createPaymentLink": false
  }'
```

3. Telegram webhook を `https://<production-hostname>/telegram/webhook` に向けます。

4. Telegram bot に URL を含むメッセージを送り、RevenueAgentPlatform の結果が Telegram に要約返信されることを確認します。

5. OpenClaw も併用する場合だけ、OpenClaw Gateway の `REVENUE_AGENT_BASE_URL` を本番 URL に向け、revenue-agent skill から JSON result を要約できることを確認します。

## 現在の初回デプロイ

2026-05-14 に Cloudflare Containers へ初回デプロイしました。

| 項目 | 値 |
| --- | --- |
| RevenueAgentPlatform URL | `https://revenue-agent-platform.haruki-ito0044.workers.dev` |
| RevenueAgentPlatform version | `786b1c17-e695-4797-8bb2-9cff11df38f3` |
| Latest RevenueAgentPlatform version | `eb41282c-7e68-466f-8e46-05936094c10c` |
| OpenClaw Gateway URL | `https://openclaw-gateway.haruki-ito0044.workers.dev` |
| OpenClaw Gateway version | `9313d517-4ab8-4a43-9aba-fb85d79ccce0` |
| Side effects | `REVENUE_AGENT_ALLOW_EMAIL=false`, `REVENUE_AGENT_ALLOW_TELEGRAM=false`, `REVENUE_AGENT_ALLOW_PAYMENT_LINK=false` |

Verified:

- `GET /health` returned HTTP 200 with `{"status":"ok"}`.
- Direct `POST /api/revenue-agent/run` returned HTTP 200 for `https://example.com` with `crawl_and_score=passed`, `generate_proposal=passed`, and all side-effect steps skipped.
- Worker-level Rate Limiting returned HTTP 429 after repeated invalid `POST /api/revenue-agent/run` requests. In the bounded check, 30 requests produced 22 `401` responses and 8 `429` responses.
- OpenClaw Gateway production secrets were configured for `REVENUE_AGENT_BASE_URL` and `REVENUE_AGENT_INTEGRATION_TOKEN`, then Gateway was redeployed and reached `running`.
- OpenClaw Gateway `POST /api/revenue-agent/verify` returned HTTP 200. The Gateway container invoked production `POST /api/revenue-agent/run` with the configured Bearer token and received the expected API validation response `HTTP 400 {"error":"url must be a valid URL"}`, confirming the request reached RevenueAgentPlatform past authentication without triggering crawl side effects.
- Telegram webhook was switched to `https://revenue-agent-platform.haruki-ito0044.workers.dev/telegram/webhook` with `secret_token` protection. A request without `X-Telegram-Bot-Api-Secret-Token` returned HTTP 401.

## ロールバック

デプロイ後に検証が失敗した場合:

1. OpenClaw Gateway の `REVENUE_AGENT_BASE_URL` を直前の known-good URL に戻します。
2. Cloudflare の route を直前の Worker / Container version に戻します。
3. Side-effect flags は `false` のまま維持します。
4. 失敗した request id、Cloudflare logs、RevenueAgentPlatform logs を確認します。

初回デプロイ前に、以下をメモしておきます。

```text
previous_known_good_REVENUE_AGENT_BASE_URL=
current_candidate_REVENUE_AGENT_BASE_URL=
deployed_at=
rollback_owner=
```

## 参考リンク

- Cloudflare Containers pricing: https://developers.cloudflare.com/containers/pricing/
- Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Tunnel: https://www.cloudflare.com/products/tunnel/
