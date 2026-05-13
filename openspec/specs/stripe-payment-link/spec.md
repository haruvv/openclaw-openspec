## Purpose

HIL承認済みターゲットに対してStripe Payment Linkを発行・送付し、有効期限、リマインド、決済完了状態を管理する。

## Requirements

### Requirement: HIL承認後にStripe Payment Linkを生成する
システムは、HIL承認フローで「承認済み」になったターゲットに対して、Stripe Payment Link APIを使ってPayment Linkを生成しなければならない（SHALL）。

#### Scenario: Payment Linkの生成に成功する
- **WHEN** ターゲットのステータスが「承認済み」になる
- **THEN** Stripe APIがPayment Linkを生成し、URLが返される

#### Scenario: Stripe APIがエラーを返す
- **WHEN** Stripe APIが4xx/5xxエラーを返す
- **THEN** 最大3回リトライし、全て失敗した場合はエラーログに記録してHIL通知を送る

### Requirement: Payment Linkの有効期限を30日に設定する
システムは、生成するPayment Linkに30日間の有効期限を設定し、有効期限をターゲット状態として永続化しなければならない（SHALL）。

#### Scenario: 有効期限付きPayment Linkの生成
- **WHEN** Payment Linkを生成する
- **THEN** リンクの有効期限が生成日から30日後に設定される
- **AND** 有効期限タイムスタンプがターゲット状態に保存される

### Requirement: Payment LinkをターゲットにメールとTelegramで送付する
システムは、生成されたPayment LinkをターゲットのメールアドレスにSendGrid経由で送信し、同時にTelegramチャットにも通知しなければならない（SHALL）。

#### Scenario: Payment Linkのメール送付に成功する
- **WHEN** Payment Linkの生成が完了する
- **THEN** Payment LinkのURLを含むメールがターゲットのアドレスに送信される

#### Scenario: 送付完了のTelegram通知
- **WHEN** Payment Linkのメールをターゲットへ送信する
- **THEN** Telegramチャットに「Payment Link送付完了」の通知が送られ、ターゲット企業名とリンクURLが含まれる

### Requirement: 有効期限の7日前にリマインドメールを送る
システムは、Payment Linkの有効期限7日前にターゲットへリマインドメールを自動送信し、送信済み時刻を永続化しなければならない（SHALL）。

#### Scenario: リマインドメールの送信
- **WHEN** Payment Linkの有効期限まで残り7日になり、まだリマインドが送信されていない
- **THEN** ターゲットに期限を記載したリマインドメールが送信される
- **AND** リマインド送信済み時刻がターゲット状態に保存される

### Requirement: 決済完了を検出してパイプラインを完了状態にする
システムは、Stripe Webhookを通じて決済完了イベント（`checkout.session.completed` または `payment_intent.succeeded`）を受信した場合、該当ターゲットのステータスを「着金確認済み」に更新しなければならない（SHALL）。

#### Scenario: 決済完了の検出
- **WHEN** Stripe Webhookが決済完了イベントを送信する
- **THEN** ターゲットのステータスが「着金確認済み」に更新され、Telegramに完了通知が送られる
