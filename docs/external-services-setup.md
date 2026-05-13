# 外部サービス登録手順

このドキュメントは、このリポジトリのローカル実行と E2E smoke test に必要な外部サービスの登録手順をまとめたものです。API キーやトークンは `.env` にだけ保存し、Git にはコミットしないでください。

## 対象サービス

| サービス | 用途 | 必須度 | 主な環境変数 |
| --- | --- | --- | --- |
| Firecrawl | サイトクロール、SEO スコアリング入力 | 必須 | `FIRECRAWL_API_KEY` |
| Gemini API | 提案文生成 | 必須 | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Z.ai | Gemini レート制限時の任意フォールバック | 任意 | `ZAI_API_KEY`, `ZAI_BASE_URL`, `ZAI_MODEL` |
| Telegram Bot API | HIL 承認通知、決済通知、smoke 通知 | 推奨 | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Stripe | Payment Link 生成、Webhook 検証 | 任意 | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| SendGrid | メール送信 | 任意 | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` |

## 事前準備

1. `.env.example` を `.env` にコピーします。
2. 最初は副作用のある送信系を無効にします。

```dotenv
SMOKE_SEND_EMAIL=false
SMOKE_SEND_TELEGRAM=false
SMOKE_CREATE_STRIPE_LINK=false
```

3. API キーはサービスごとに登録後、必要なものだけ `.env` に追記します。
4. Lighthouse が Chrome を見つけられない環境では、`CHROME_PATH` を設定します。macOS の Google Chrome は通常次のパスです。

```dotenv
CHROME_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

## Firecrawl

Firecrawl はクロールとページ抽出に使います。

1. Firecrawl にサインアップします。
2. Dashboard から API key を作成または確認します。
3. `.env` に設定します。

```dotenv
FIRECRAWL_API_KEY=fc-...
```

確認ポイント:

- Free plan やクレジット量は変更される可能性があるため、登録前に公式 pricing を確認してください。
- smoke test では `crawl_and_score` ステップで使われます。

## Gemini API

Gemini API は提案文生成の主系 LLM として使います。

1. Google AI Studio にアクセスします。
2. API Keys ページで Gemini API key を作成します。
3. 必要ならキーを Gemini API のみに制限します。
4. `.env` に設定します。

```dotenv
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
```

確認ポイント:

- 無料枠はありますが、利用可能モデル、レート制限、課金条件は変更されます。公式 pricing と rate limits を確認してください。
- smoke test では `generate_proposal` ステップで使われます。

## Z.ai

Z.ai は Gemini がレート制限などで失敗した場合の任意フォールバックです。最初の smoke test では未設定でも構いません。

1. Z.ai の開発者向けコンソールでアカウントを作成します。
2. API key を作成します。
3. `.env` に設定します。

```dotenv
ZAI_API_KEY=...
ZAI_BASE_URL=https://api.z.ai/api/paas/v4
ZAI_MODEL=glm-4.5-flash
```

確認ポイント:

- このリポジトリでは Z.ai の OpenAI 互換 API として `/chat/completions` に接続します。
- `glm-4.5-flash` は通常 endpoint で試しやすいモデルです。
- GLM Coding Plan を使う場合は、対象ツール/用途に応じて `ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4` を検討してください。
- 無料枠、Coding Plan、通常 API 残高は扱いが異なるため、公式ダッシュボードで確認してください。

## Telegram

Telegram は Slack の代替通知先として使います。Bot token と通知先 chat ID が必要です。

1. Telegram で BotFather を開きます。
2. `/newbot` を実行し、Bot 名と username を登録します。
3. BotFather が返す token を控えます。
4. 通知先にする自分のチャット、またはグループに Bot を追加します。
5. Bot 宛て、または Bot が入ったグループに何か 1 件メッセージを送ります。
6. 次の URL をブラウザで開き、`chat.id` を確認します。

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates
```

7. `.env` に設定します。

```dotenv
TELEGRAM_BOT_TOKEN=123456789:...
TELEGRAM_CHAT_ID=123456789
```

グループ通知の場合、`TELEGRAM_CHAT_ID` は負の数になることがあります。

smoke test で Telegram 送信まで確認する場合だけ、次を有効にします。

```dotenv
SMOKE_SEND_TELEGRAM=true
```

## Stripe

Stripe は Payment Link 生成と Webhook 署名検証に使います。最初は必ず test mode だけを使ってください。

1. Stripe アカウントを作成します。
2. Dashboard で test mode を有効にします。
3. Developers > API keys から test secret key を取得します。
4. `.env` に設定します。

```dotenv
STRIPE_SECRET_KEY=sk_test_...
```

Webhook をローカルまたは検証環境で受ける場合:

1. Stripe Dashboard または Stripe CLI で webhook endpoint を作成します。
2. signing secret を取得します。
3. `.env` に設定します。

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_...
```

smoke test で Payment Link 作成まで確認する場合だけ、次を有効にします。

```dotenv
SMOKE_CREATE_STRIPE_LINK=true
SMOKE_STRIPE_AMOUNT_JPY=100
```

注意:

- smoke test では `sk_live_` ではなく `sk_test_` を使ってください。
- test mode の操作は実課金されませんが、live mode では通常の Stripe 手数料と実取引が発生します。

## SendGrid

SendGrid はメール送信に使います。まずは自分のメールアドレス宛てだけでテストしてください。

1. Twilio SendGrid アカウントを作成します。
2. Sender Authentication で Single Sender Verification、または Domain Authentication を完了します。
3. Settings > API Keys で API key を作成します。
4. 権限はまず Custom Access を選び、Mail Send に必要な権限だけ付けます。
5. 作成直後に表示される API key を控えます。あとから再表示できません。
6. `.env` に設定します。

```dotenv
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=verified-sender@example.com
SENDGRID_FROM_NAME=OpenClaw Smoke
```

smoke test でメール送信まで確認する場合だけ、次を有効にします。

```dotenv
SMOKE_SEND_EMAIL=true
SMOKE_EMAIL_TO=your-address@example.com
```

確認ポイント:

- `SENDGRID_FROM_EMAIL` は SendGrid 側で認証済みの送信元にしてください。
- Free plan や送信上限は変更される可能性があるため、登録前に公式 pricing とアカウント画面を確認してください。

## 推奨 smoke test 手順

### 1. 副作用なしで実行

まず Firecrawl と Gemini だけで実行します。

```dotenv
SMOKE_SEND_EMAIL=false
SMOKE_SEND_TELEGRAM=false
SMOKE_CREATE_STRIPE_LINK=false
```

```bash
npm run smoke:e2e -- https://example.com
```

### 2. Telegram 通知を追加

```dotenv
SMOKE_SEND_TELEGRAM=true
```

```bash
npm run smoke:e2e -- https://example.com
```

### 3. Stripe test mode を追加

```dotenv
SMOKE_CREATE_STRIPE_LINK=true
STRIPE_SECRET_KEY=sk_test_...
```

```bash
npm run smoke:e2e -- https://example.com
```

### 4. SendGrid 自分宛て送信を追加

```dotenv
SMOKE_SEND_EMAIL=true
SMOKE_EMAIL_TO=your-address@example.com
```

```bash
npm run smoke:e2e -- https://example.com
```

smoke report は `output/smoke-runs/*.json` に保存されます。

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| `crawl_and_score` が skipped | `FIRECRAWL_API_KEY` が `.env` にあるか |
| `generate_proposal` が skipped | `GEMINI_API_KEY` が `.env` にあるか |
| Gemini が model not found になる | `GEMINI_MODEL` が現在利用可能なモデル名か |
| Telegram が `chat not found` | Bot に先にメッセージを送ったか、group に Bot を追加したか、`TELEGRAM_CHAT_ID` が正しいか |
| Telegram が `Unauthorized` | `TELEGRAM_BOT_TOKEN` が正しいか |
| Stripe が失敗する | `STRIPE_SECRET_KEY` が `sk_test_` で始まるか、test mode のキーか |
| Webhook 署名検証が失敗する | `STRIPE_WEBHOOK_SECRET` が対象 endpoint の signing secret か |
| SendGrid が送信元エラーになる | `SENDGRID_FROM_EMAIL` が認証済み sender か |
| SendGrid API key が見つからない | API key は作成時に一度しか表示されないため、紛失時は作り直す |
| Lighthouse が timeout する | Chrome/Chromium が存在するか、必要なら `CHROME_PATH` を設定する |

## セキュリティ運用

- `.env` は Git にコミットしないでください。
- smoke test では Stripe live key を使わないでください。
- API key が漏れた可能性がある場合は、該当サービスで即時 revoke して再発行してください。
- 本番用とローカル検証用の API key は分けてください。
- Gemini API key は可能なら Gemini API のみに制限してください。

## 参考リンク

- Firecrawl pricing: https://www.firecrawl.dev/pricing
- Firecrawl Scrape API docs: https://docs.firecrawl.dev/api-reference/endpoint/scrape
- Gemini API key docs: https://ai.google.dev/gemini-api/docs/api-key
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Telegram Bot API: https://core.telegram.org/bots/api
- SendGrid API keys: https://www.twilio.com/docs/sendgrid/ui/account-and-settings/api-keys
- SendGrid sender verification: https://www.twilio.com/docs/sendgrid/ui/sending-email/sender-verification
- Stripe test mode: https://docs.stripe.com/test-mode
- Stripe API keys: https://docs.stripe.com/keys
- Stripe webhook signatures: https://docs.stripe.com/webhooks/signature
