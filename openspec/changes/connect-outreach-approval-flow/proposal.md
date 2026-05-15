## Why

SEO営業の管理画面は、調査結果・営業評価・提案書までは本番のD1/R2永続フローに乗っているが、営業メール送信とStripe Payment Link生成はまだ管理画面の承認導線に接続されていない。副作用を本番で有効化する前に、人間確認済みの営業送信・決済リンク生成・送信ログを同じ運用データモデルに統合する必要がある。

## What Changes

- 管理画面の実行詳細またはURL別実行ログから、営業メール送信前レビューを開けるようにする。
- レビュー画面では、宛先メール、件名、本文、営業評価、提案書、注意事項を確認し、人間が編集または承認して送信できるようにする。
- 営業メール送信はsmoke用 `sendgrid_email` step と分離し、ターゲット企業の公開メールアドレスへ送る本番用アウトリーチとして扱う。
- 送信ログ、宛先、件名、本文、ステータス、重複送信防止情報をD1/R2前提の運用データとして保存する。
- 決済リンクは初回メール送信時ではなく、人間承認後に生成し、StripeのURL・金額・有効期限・送付状態を運用データへ保存する。
- HIL承認URLは、旧SQLite `targets` 前提ではなく、D1/R2に保存されたアウトリーチ/商談状態を更新する。
- 既存のsmoke/test用メール送信・Stripeリンク生成は、本番営業導線と混同しない名称・用途に整理する。
- **BREAKING**: 管理画面から副作用をONにしても、レビュー承認なしに営業メールまたはPayment Linkを自動送信してはならない。

## Capabilities

### New Capabilities

- `sales-approval-workflow`: 管理画面で営業メールとPayment Linkを人間確認・承認して実行する導線。

### Modified Capabilities

- `outreach-sender`: smoke送信ではなく、レビュー済み営業メールをターゲット宛に送信し、D1/R2へ送信ログを保存する。
- `hil-approval-flow`: HIL承認/却下をD1/R2上の営業状態に対して行い、承認後の決済リンク生成を制御する。
- `stripe-payment-link`: 人間承認済みの対象にだけStripe Payment Linkを生成し、D1/R2へリンク状態を保存する。
- `operational-data-persistence`: アウトリーチ、承認、決済リンク状態を既存の運用永続化対象に含める。

## Impact

- `src/admin/routes.ts`: 営業レビュー、送信、決済リンク作成APIの追加。
- `admin-ui/src/pages/*`, `admin-ui/src/components/*`: レビュー画面、送信状態、決済リンク表示の追加。
- `src/revenue-agent/runner.ts`: smoke用副作用stepと本番営業導線の分離。
- `src/outreach-sender/*`: D1/R2対応、承認済み送信、重複防止、送信ログ。
- `src/hil-approval-flow/*`: D1/R2上の営業状態更新。
- `src/stripe-payment-link/*`: D1/R2対応、金額/有効期限/URL保存、送信通知。
- `worker/storage-bridge.ts`, migrations: 必要なD1テーブル/カラム追加。
- Tests: admin UI、admin routes、outreach sender、HIL、Stripe、production smoke対象の更新。
