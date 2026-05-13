## Context

OpenClawをオーケストレーション基盤とし、外部APIを組み合わせて「クロール→提案書生成→アウトリーチ→HIL承認→Stripe決済リンク送付」のパイプラインを構築する。各ステップはOpenClawのAgentic Loopが呼び出すツール（MCP経由）として実装し、ステート管理はOpenClaw Gatewayが担う。

現状：SEO営業の全工程が手動。ターゲット探索だけで1日、提案書作成で2〜3時間/件かかっている。

制約：
- コード実装（GitHub PR）と契約自動締結はMVPスコープ外
- HILは必須（高額取引・個人情報を扱うため）
- 外部APIの利用規約を遵守する（LinkedIn等スクレイピング禁止のものは使わない）

## Goals / Non-Goals

**Goals:**
- Firecrawl + Lighthouse によるSEOスコア自動評価でターゲットリストを生成する
- LLMによる提案書の自動生成（企業ごとのパーソナライズ含む）
- SendGrid経由でのアウトリーチメール自動送信
- 返信検出 → HIL承認 → Stripe Payment Link送付の自動フロー
- OpenClaw Gatewayを通じた全ステップの実行制御とセッション管理

**Non-Goals:**
- GitHubへのPR自動作成・コード実装
- DocuSignによる契約自動締結
- 成果報酬の自動計算・請求
- 複数案件の並列管理（フェーズ2）

## Decisions

### D1: オーケストレーションにOpenClaw Gatewayを採用する

**選択**: OpenClaw Gateway + Agentic Loop

**理由**: MCPプロトコルで外部ツールを標準化して接続でき、セッション管理・ツールルーティング・HIL通知を1箇所に集約できる。自前でエージェントループを実装するより信頼性が高い。

**却下した代替案**: LangChain / CrewAI — 外部依存が増え、OpenClawとの二重管理になる。

---

### D2: クロールはFirecrawl、スコアリングはLighthouse CLI を使う

**選択**: Firecrawl でページ収集 → Lighthouse CLI で各ページのSEOスコアを測定

**理由**: Firecrawlは動的サイト（JavaScript rendering）に対応しており、SPA型の企業サイトでも確実にコンテンツを取得できる。LighthouseはGoogleの公式ツールで、実際のSEO評価基準に近いスコアが得られる。

**スコアの閾値**: SEOカテゴリスコア ≤ 50 をターゲットとする（初期値、チューニング可）

**却下した代替案**: Serper.dev での検索結果ベースのフィルタリング — サイトの実態ではなく検索順位を見ることになり、改善余地の大きいサイトを見落とす可能性がある。

---

### D3: 提案書はLLMで生成し、Markdownで出力する（PDFはオプション）

**選択**: Claude API（claude-sonnet-4-6）でMarkdown提案書を生成。PDF化はmarkdown-pdfライブラリ経由でオプション提供。

**理由**: LLMはLighthouseの診断結果をそのまま読み込んでパーソナライズされた文章を生成できる。Markdownを一次成果物にすることで、確認・編集がしやすい。

**プロンプト設計**: システムプロンプトにSEOコンサルタントのペルソナを与え、Lighthouse診断結果・企業名・業種を入力として渡す。

---

### D4: HILはSlack通知 + 承認リンク方式とする

**選択**: OpenClaw Gateway経由でSlackに通知を送り、承認/却下のURLをメッセージに含める。承認URLへのアクセスでエージェントの次ステップが解放される。

**理由**: Slackは多くのビジネスユーザーが常時確認しており、承認コストが最も低い。メール承認よりレスポンスが速い。

**却下した代替案**: メール承認フロー — 確認が遅れるリスクがある。インタラクティブUI — MVPでは過剰。

---

### D5: StripeはPayment Linkを使い、Checkout Sessionは使わない

**選択**: Stripe Payment Link API でリンクを生成して送付

**理由**: Payment Linkはコードなしで独立したリンクを生成でき、顧客側にStripeアカウントが不要。Checkout Sessionは自前のWebサーバが必要でMVP段階では過剰。

## Risks / Trade-offs

| リスク | 緩和策 |
|--------|--------|
| Firecrawlのレート制限により大量クロールが遅延する | バッチサイズを1回50件以下に制限し、クロール間隔を設ける |
| Lighthouse測定がタイムアウトする（特に重いサイト） | タイムアウトを30秒に設定し、失敗したURLはスキップしてログに記録 |
| アウトリーチメールがスパム判定される | SendGridのドメイン認証（DKIM/SPF）を必須化、送信レートを1日50件以下に制限 |
| HIL承認が滞留してパイプラインが止まる | 48時間未承認の場合は自動で「保留」ステータスに移行し、再通知する |
| Stripe Payment Linkの有効期限切れ | リンク生成時に30日の有効期限を設定し、期限前に顧客へリマインドを送る |

## Open Questions

- OpenClaw GatewayのMCPサーバ設定ファイルの形式・配置場所（要確認）
- Lighthouseをサーバサイドで実行する際のChrome/Chromiumの管理方法（Docker推奨か）
- SendGridの送信ドメインをどのドメインで認証するか（プロダクト環境用のドメインが必要）
- HIL承認URLの生成・検証をOpenClaw側で担うか、別途Webhookサーバが必要か
