## MODIFIED Requirements

### Requirement: Payment LinkをターゲットにメールとTelegramで送付する
システムは、生成されたPayment LinkをターゲットのメールアドレスにSendGrid経由で送信し、同時にTelegramチャットにも通知しなければならない（SHALL）。

#### Scenario: Payment Linkのメール送付に成功する
- **WHEN** Payment Linkの生成が完了する
- **THEN** Payment LinkのURLを含むメールがターゲットのアドレスに送信される

#### Scenario: 送付完了のTelegram通知
- **WHEN** Payment Linkのメールをターゲットへ送信する
- **THEN** Telegramチャットに「Payment Link送付完了」の通知が送られ、ターゲット企業名とリンクURLが含まれる

### Requirement: 決済完了を検出してパイプラインを完了状態にする
システムは、Stripe Webhookを通じて決済完了イベント（`checkout.session.completed` または `payment_intent.succeeded`）を受信した場合、該当ターゲットのステータスを「着金確認済み」に更新しなければならない（SHALL）。

#### Scenario: 決済完了の検出
- **WHEN** Stripe Webhookが決済完了イベントを送信する
- **THEN** ターゲットのステータスが「着金確認済み」に更新され、Telegramに完了通知が送られる
