## MODIFIED Requirements

### Requirement: HIL承認後にStripe Payment Linkを生成する
システムは、HIL承認済みまたは管理画面で人間が明示承認した営業対象に対してのみ、Stripe Payment Link APIを使ってPayment Linkを生成しなければならない（SHALL）。初回アウトリーチメール送信、解析完了、提案書生成を理由にPayment Linkを自動生成してはならない（SHALL NOT）。

#### Scenario: Payment Linkの生成に成功する
- **WHEN** 営業対象が人間によりPayment Link作成を承認され、Stripe設定とPayment Link作成ポリシーが有効である
- **THEN** Stripe APIがPayment Linkを生成し、URLが返される
- **AND** Payment LinkのURL、Stripe ID、金額、ステータスがD1/R2前提の運用データに保存される

#### Scenario: Stripe APIがエラーを返す
- **WHEN** Stripe APIが4xx/5xxエラーを返す
- **THEN** 最大3回リトライし、全て失敗した場合は失敗ステータスとエラーをPayment Link記録に保存する

### Requirement: Payment Linkの有効期限を30日に設定する
システムは、生成するPayment Linkに30日間の有効期限を設定し、有効期限をD1/R2前提のPayment Link状態として永続化しなければならない（SHALL）。

#### Scenario: 有効期限付きPayment Linkの生成
- **WHEN** Payment Linkを生成する
- **THEN** リンクの有効期限が生成日から30日後に設定される
- **AND** 有効期限タイムスタンプがPayment Link記録に保存される

### Requirement: Payment LinkをターゲットにメールとTelegramで送付する
システムは、管理者が送付を承認した場合、生成されたPayment LinkをターゲットのメールアドレスにSendGrid経由で送信し、設定されている場合はTelegramチャットにも通知しなければならない（SHALL）。メール送信ポリシーが無効な場合は、Payment Linkを作成してもターゲットへメール送付してはならない（SHALL NOT）。

#### Scenario: Payment Linkのメール送付に成功する
- **WHEN** Payment Linkの生成が完了し、管理者が送付を承認し、メール送信ポリシーが有効である
- **THEN** Payment LinkのURLを含むメールがターゲットのアドレスに送信される
- **AND** 送付時刻がPayment Link記録に保存される

#### Scenario: 送付完了のTelegram通知
- **WHEN** Payment Linkのメールをターゲットへ送信し、Telegram設定が有効である
- **THEN** Telegramチャットに「Payment Link送付完了」の通知が送られ、ターゲット企業名とリンクURLが含まれる
