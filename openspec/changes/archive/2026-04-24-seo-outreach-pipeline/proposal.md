## Why

SEOスコアが低い企業を手動で探し、個別に提案書を作成してアウトリーチするプロセスは時間とコストがかかりすぎる。このパイプラインを自動化することで、OpenClawエージェントが見込み顧客の発見から最初の支払い受け付けまでを自律実行し、人間の介入を最小化しながら新規顧客獲得の速度を大幅に上げる。

## What Changes

- **新規**: Firecrawl + Lighthouse を使ったSEOスコアリングパイプラインを構築し、低スコアサイトを自動抽出する
- **新規**: LLMを使った改善提案書（Markdown/PDF）の自動生成機能を追加する
- **新規**: SendGrid経由でメールアウトリーチを自動送信する機能を追加する
- **新規**: 返信・関心ありシグナルの検出後、Human-in-the-loop（HIL）で人間に承認を通知するフローを追加する
- **新規**: Stripe Payment Link を自動生成し、承認後に送付するフローを追加する
- **除外（フェーズ2以降）**: GitHub PRによるコード実装自動化
- **除外（フェーズ2以降）**: DocuSign による契約自動締結
- **除外（フェーズ2以降）**: 成果報酬の自動計算・請求

## Capabilities

### New Capabilities

- `site-crawler`: 特定業種のサイトをFirecrawlでクロールし、Lighthouseスコアで低品質サイトを抽出・リスト化する
- `proposal-generator`: クロール結果をもとにLLMでSEO課題を分析し、パーソナライズされた改善提案書を生成する
- `outreach-sender`: SendGrid APIを通じて提案書付きのアウトリーチメールを送信する
- `hil-approval-flow`: 返信・関心ありシグナルを検出し、Slack/メールで人間に承認通知を送るHuman-in-the-loopフローを実装する
- `stripe-payment-link`: 承認後にStripe Payment Linkを生成し、見込み顧客に送付する

### Modified Capabilities

（既存のスペックなし）

## Impact

- **依存する外部サービス**: Firecrawl API, Lighthouse (CLI or API), SendGrid API, Stripe API, OpenClaw Gateway
- **新規作成するモジュール**: `site-crawler`, `proposal-generator`, `outreach-sender`, `hil-approval-flow`, `stripe-payment-link`
- **OpenClawの利用**: エージェントのオーケストレーション基盤としてOpenClaw Gatewayを使用し、各ステップ間のセッション管理とツール呼び出しルーティングを担わせる
- **HILポイント**: アウトリーチ送信前・Stripe決済リンク送付前の2箇所で人間の承認を必須とする
