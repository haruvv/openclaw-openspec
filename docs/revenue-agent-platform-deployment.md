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
| Hostname | 初期は `https://revenue-agent-platform.<workers-subdomain>.workers.dev`。Access 本運用では独自ドメインを推奨 |
| TLS | Cloudflare managed HTTPS |
| Access | Cloudflare Access で管理画面と機械 API を保護 |
| Rate Limiting | Workers Rate Limiting binding で `POST /api/revenue-agent/run` を対象に設定 |
| Request filtering | 必要に応じて WAF / custom rules を追加 |
| Logs | Authorization header や API key を出さない |

Rate Limiting は Cloudflare 側を第一防衛線にし、アプリ側の `REVENUE_AGENT_RATE_LIMIT_PER_MINUTE` はローカル fallback として残します。

`wrangler.jsonc` では `REVENUE_AGENT_RUN_LIMITER` binding を設定し、`POST /api/revenue-agent/run` だけを client IP ごとに 60 秒 10 requests へ制限します。この制限は Worker wrapper で container に proxy する前に評価するため、無効 token や不正 request でも高コストな container 実行へ進みにくくなります。

`wrangler.jsonc` では `workers_dev=true` を明示していますが、Cloudflare Access を安定運用する本番 URL は Cloudflare 管理の独自 hostname を推奨します。独自ドメインを使う場合は、Cloudflare zone が決まった後で `routes` を追加し、その hostname に Access application を設定します。

Cloudflare Access の保護対象:

| 対象 path | Access policy |
| --- | --- |
| `/admin`, `/admin/*` | 管理者の本人確認を必須にする。MFA も必須 |
| `/api/admin`, `/api/admin/*` | 管理者の本人確認を必須にする。Smoke 用 Service Token を許可する場合のみ `CLOUDFLARE_ACCESS_ALLOW_SERVICE_ADMIN=true` |
| `POST /api/revenue-agent/run` | OpenClaw / automation 用の Service Auth policy を必須にする |
| `/health` | 秘密を含まない health check として公開するか、運用方針に応じて別 policy で保護する |
| `/telegram/webhook` | Telegram から到達できるよう Access 対象外にする。設定時は `TELEGRAM_WEBHOOK_SECRET` で検証する |
| `/webhooks/stripe` | Stripe から到達できるよう Access 対象外にする。Stripe signature validation で検証する |
| `/hil/*`, `/thank-you` | ユーザー向け導線として公開する。必要な箇所は HIL token で検証する |

アプリ側の Access JWT 検証は、以下の secret を設定して有効化します。

```bash
npx wrangler secret put CLOUDFLARE_ACCESS_ENABLED
npx wrangler secret put CLOUDFLARE_ACCESS_ISSUER
npx wrangler secret put CLOUDFLARE_ACCESS_ADMIN_AUD
npx wrangler secret put CLOUDFLARE_ACCESS_MACHINE_AUD
```

`CLOUDFLARE_ACCESS_ENABLED` は、Access application を作成し、AUD tag と smoke 用 credential を設定してから `true` にします。`wrangler secret put` で設定する値はログに出さないでください。`CLOUDFLARE_ACCESS_ISSUER` は `https://<team>.cloudflareaccess.com` のような team domain です。AUD tag は各 Access application の画面から取得します。

Cloudflare Dashboard での設定手順:

1. Zero Trust > Access > Applications を開き、Self-hosted application を作成します。管理画面用 application の対象は本番 hostname の `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*` です。
2. 管理者のメールアドレスまたはグループを許可 policy に追加します。MFA は identity provider または Access policy 側で必須にします。
3. 管理画面用 application の AUD tag をコピーし、`CLOUDFLARE_ACCESS_ADMIN_AUD` に設定します。
4. `POST /api/revenue-agent/run` 用に、機械 API 向けの Self-hosted application または path policy を作成します。
5. Access controls > Service credentials > Service Tokens で Service Token を作成します。その Service Token を機械 API application の Service Auth policy に追加し、機械 API application の AUD tag を `CLOUDFLARE_ACCESS_MACHINE_AUD` に設定します。
6. GitHub Actions の smoke test から管理 API にアクセスする場合は、smoke 専用の Service Token を別途作成して管理画面用 application に追加します。その場合だけ `CLOUDFLARE_ACCESS_ALLOW_SERVICE_ADMIN=true` を設定します。
7. Access application、AUD tag、smoke 用 credential の設定がすべて終わってから `CLOUDFLARE_ACCESS_ENABLED=true` を設定します。

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
```

### 管理ポータル

管理ポータルは `/admin` 配下で Worker Static Assets から配信します。SEO営業などの有効な business app と、株自動売買など今後追加予定の app を一覧表示します。

管理 UI は React + Tailwind の single-page app で、`npm run build` により `dist-assets/admin` に出力されます。Worker Static Assets が `/admin` 配下でその bundle を配信し、運用データは `/api/admin` 配下の JSON API から取得します。JSON API は Container へ転送されます。

本番の管理画面アクセスには Cloudflare Access が必要です。管理画面は以下の URL で開きます。

```text
https://<production-hostname>/admin
```

ブラウザログイン、MFA、session cookie は Cloudflare Access が処理します。管理 UI は admin token を browser session storage に保存せず、`/api/admin/*` への request に `token` query parameter も付与しません。`ADMIN_TOKEN` は local development または一時 rollback fallback として明示的に有効化した場合だけ使います。

### SEO営業 app

SEO営業は最初に有効化する business app です。canonical path は以下です。

```text
https://<production-hostname>/admin/seo-sales
https://<production-hostname>/admin/seo-sales/sites
https://<production-hostname>/admin/seo-sales/runs
https://<production-hostname>/admin/seo-sales/settings
```

`/admin/seo-sales/sites` は、分析済み URL を product-facing に確認する画面です。最新 status、Lighthouse SEO score、改善余地スコア、最新 proposal、snapshot history、関連 run detail へのリンクを表示します。

この platform は SEO 関連の score を 2 種類保持します。

- `seoScore`: Lighthouse の SEO category score。高いほど技術的な SEO 状態が良く、主に crawlability と基本的な SEO hygiene を反映します。
- `opportunityScore`: 営業向けの改善余地スコア。Lighthouse SEO score が高い場合でも、営業提案につながる改善余地が大きいほど高くなります。

Run detail は 3 層に分けて表示します。

- `調査結果`: Firecrawl、Lighthouse、local opportunity scoring による deterministic research。事実ベースとして扱います。
- `営業評価`: `summary.llmRevenueAudit` に保存する任意の LLM interpretation。事実ベースの調査結果を、sales priority、business impact、recommended offer、outreach draft、confidence、caveats に変換します。score の再計算や根拠のない事実追加は禁止します。
- `営業提案書`: 調査結果と、存在する場合は LLM営業評価から生成する長文 proposal artifact。

初期 outreach policy:

- 初回接触では公開 email address を優先します。
- 問い合わせフォーム向け文面は human-reviewed draft に留め、自動送信しません。
- outreach 送信前に human approval を必須にします。
- 初回接触は即時決済や契約圧力ではなく、返信獲得と無料診断共有を目的にします。
- 侮辱的、断定的、保証を匂わせる表現は避けます。

`/admin/seo-sales/runs` は運用確認用です。failure、retry、raw step、artifact、手動 RevenueAgent run/retry action を確認します。

```text
旧 URL の `/sites`, `/admin/runs`, `/admin/integrations` は SEO営業の canonical path へ redirect します。
```

クロール済み target を生成した successful RevenueAgent run は、generic run log と site result state の両方を書き込みます。target を生成しない run は `/admin/seo-sales/runs` には表示されますが、URL result record は作成しません。

独自ドメイン移行後、zone-level Rate Limiting も追加したい場合は、example をコピーして `cloudflare_zone_id` と `revenue_agent_hostname` を設定します。初期値は `POST /api/revenue-agent/run` を IP ごとに 60 秒 10 requests まで許可し、超過時は 10 分 block します。

```bash
cp infra/cloudflare/revenue-agent-rate-limit.tf.example infra/cloudflare/revenue-agent-rate-limit.tf
```

Cloudflare Dashboard で設定する場合も同じ条件にします。

```text
条件式:
(http.host eq "<production-hostname>" and http.request.method eq "POST" and http.request.uri.path eq "/api/revenue-agent/run")

集計単位:
cf.colo.id, ip.src

期間:
60 seconds

期間あたりの request 数:
10

mitigation timeout:
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
  -H "CF-Access-Client-Id: <CLOUDFLARE_ACCESS_CLIENT_ID>" \
  -H "CF-Access-Client-Secret: <CLOUDFLARE_ACCESS_CLIENT_SECRET>" \
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

確認済み:

- `GET /health` は HTTP 200 と `{"status":"ok"}` を返しました。
- `POST /api/revenue-agent/run` は `https://example.com` に対して HTTP 200 を返し、`crawl_and_score=passed`、`generate_proposal=passed`、すべての side-effect step が skipped になりました。
- Worker-level Rate Limiting は、不正な `POST /api/revenue-agent/run` を繰り返した後に HTTP 429 を返しました。限定的な確認では、30 requests のうち 22 件が `401`、8 件が `429` でした。
- OpenClaw Gateway production secrets に `REVENUE_AGENT_BASE_URL` と `REVENUE_AGENT_INTEGRATION_TOKEN` を設定し、Gateway を redeploy して `running` 到達を確認しました。
- OpenClaw Gateway `POST /api/revenue-agent/verify` は HTTP 200 を返しました。Gateway container は設定済み Bearer token で production の `POST /api/revenue-agent/run` を呼び、期待通り `HTTP 400 {"error":"url must be a valid URL"}` を受け取りました。これにより、副作用を発生させずに RevenueAgentPlatform の認証境界を越えて request が到達することを確認しました。
- Telegram webhook は `secret_token` protection 付きで `https://revenue-agent-platform.haruki-ito0044.workers.dev/telegram/webhook` に切り替えました。`X-Telegram-Bot-Api-Secret-Token` なしの request は HTTP 401 を返しました。

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
