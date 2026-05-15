## MODIFIED Requirements

### Requirement: SendGrid APIでアウトリーチメールを送信する
システムは、管理画面で人間が確認・承認したアウトリーチ文面を、SendGrid APIを通じてターゲット企業の問い合わせメールアドレスに送信しなければならない（SHALL）。送信に成功した場合、送信ログにタイムスタンプ・宛先・件名・ステータスがD1/R2前提の運用データとして記録されなければならない（SHALL）。初回アウトリーチ送信の成功だけを理由にPayment Linkを自動生成してはならない（SHALL NOT）。

#### Scenario: メール送信が成功する
- **WHEN** 有効な宛先メールアドレス、レビュー済み件名、レビュー済み本文、SendGrid設定が揃っている
- **THEN** SendGrid APIが202 Acceptedを返し、送信ログにタイムスタンプ・宛先・件名・本文・ステータスが記録される
- **AND** 該当ターゲットの営業状態が「アウトリーチ送信済み」として管理画面に表示される

#### Scenario: 宛先メールアドレスが見つからない
- **WHEN** クロール結果にメールアドレスが含まれていない
- **THEN** システムは送信を実行せず、管理画面で宛先入力を要求する
- **AND** 問い合わせフォーム投稿は自動実行されない

#### Scenario: SendGrid APIがエラーを返す
- **WHEN** SendGrid APIが4xx/5xxエラーを返す
- **THEN** 最大3回リトライし、全て失敗した場合は失敗ステータスとエラーを送信ログに記録する

### Requirement: 送信済みターゲットへの重複送信を防ぐ
システムは、過去30日以内にアウトリーチ済みのドメインに対して重複送信してはならない（SHALL NOT）。この判定はD1/R2前提の永続送信ログに基づかなければならない（SHALL）。

#### Scenario: 重複送信の防止
- **WHEN** 管理者が過去30日以内に送信済みのドメインへアウトリーチ送信しようとする
- **THEN** システムは送信を拒否し、「重複スキップ」として管理画面に表示する
- **AND** SendGrid APIは呼び出されない

## ADDED Requirements

### Requirement: Smoke email sending remains separate
システムは、本番営業メール送信とsmoke/test用メール送信を区別しなければならない（SHALL）。smoke/test用送信はターゲット企業への営業送信として記録してはならない（SHALL NOT）。

#### Scenario: Smoke side effect runs
- **WHEN** production smoke or API smoke requests a test email side effect
- **THEN** the system sends only the configured smoke/test message
- **AND** the system does not mark a target as having received production outreach
