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

## Cloudflare 設定

初期本番で必要な Cloudflare 設定:

| 項目 | 方針 |
| --- | --- |
| Hosting | Cloudflare Containers |
| Hostname | 例: `revenue-agent.<domain>` |
| TLS | Cloudflare managed HTTPS |
| Rate Limiting | `POST /api/revenue-agent/run` を対象に設定 |
| Request filtering | 必要に応じて WAF / custom rules を追加 |
| Logs | Authorization header や API key を出さない |

Rate Limiting は Cloudflare 側を第一防衛線にし、アプリ側の `REVENUE_AGENT_RATE_LIMIT_PER_MINUTE` はローカル fallback として残します。

## 初回検証

1. `GET /health` を確認します。

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

3. Direct API が通った後に OpenClaw Gateway の `REVENUE_AGENT_BASE_URL` を本番 URL に向けます。

4. OpenClaw から revenue-agent skill を実行し、RevenueAgentPlatform の JSON result を要約できることを確認します。

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
