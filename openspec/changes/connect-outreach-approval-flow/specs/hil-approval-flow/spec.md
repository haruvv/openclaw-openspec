## MODIFIED Requirements

### Requirement: 承認URLへのアクセスでパイプラインの次ステップを解放する
システムは、人間が承認URLにアクセスした場合に当該営業対象の状態を「承認済み」に更新し、Stripe Payment Link生成を許可しなければならない（SHALL）。状態更新はD1/R2前提の運用データに対して行われなければならない（SHALL）。HIL承認なしにPayment Linkを送付してはならない（SHALL NOT）。

#### Scenario: 承認URLへのアクセス
- **WHEN** 人間が承認URLにアクセスする
- **THEN** 営業対象の状態が「承認済み」に更新される
- **AND** 管理画面または承認後処理からStripe Payment Link生成が可能になる

#### Scenario: 却下URLへのアクセス
- **WHEN** 人間が却下URLにアクセスする
- **THEN** 営業対象の状態が「却下」に更新され、Payment Linkは生成されない

## ADDED Requirements

### Requirement: Admin approval can replace Telegram approval for MVP
システムは、MVPの営業送信とPayment Link作成において、Telegram承認URLだけでなく管理画面上の認証済み操作をHIL承認として扱えなければならない（SHALL）。

#### Scenario: Admin approves from the management UI
- **WHEN** an authenticated admin confirms Payment Link creation in the management UI
- **THEN** the system treats the action as human approval for that Payment Link creation
- **AND** the action is recorded in durable operational data
