## MODIFIED Requirements

### Requirement: Telegram経由でHIL通知を送る
システムは、HILトリガー時にTelegram Bot APIを通じて指定チャットに通知を送り、承認URLと却下URLをメッセージに含めなければならない（SHALL）。

#### Scenario: Telegram通知の送信に成功する
- **WHEN** HIL承認フローが起動する
- **THEN** 指定のTelegramチャットに、ターゲット企業名・SEOスコア・承認URL・却下URLを含む通知が送信される

#### Scenario: Telegram通知の送信に失敗する
- **WHEN** Telegram APIがエラーを返す
- **THEN** フォールバックとしてメール通知を送り、エラーをログに記録する

### Requirement: 48時間未承認の場合は「保留」に移行して再通知する
システムは、HILトリガーから48時間経過しても承認・却下の操作がない場合、ステータスを「保留」に変更し、Telegramに再通知しなければならない（SHALL）。

#### Scenario: 48時間未承認での再通知
- **WHEN** HILトリガーから48時間経過しても操作がない
- **THEN** ターゲットのステータスが「保留」に更新され、Telegramに「期限切れ: 再確認をお願いします」の通知が送られる
