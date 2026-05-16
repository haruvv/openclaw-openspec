## Why

現在のSEO営業管理画面は、解析後に管理者が宛先、文面、金額、Payment Link作成タイミングを毎回判断する必要があり、運用負荷が高い。SEO診断と営業評価はすでにAIで生成できているため、管理者の役割を最終承認に絞ることで、少ない手数で安全に営業メール送信まで進められる。

## What Changes

- 解析済みrunからAI補助の営業承認案を生成する。
- 承認案には宛先候補、件名、本文、推奨金額、優先度、判断理由、注意事項を含める。
- 管理画面の営業アクションを「編集して送信」中心から「承認して送信」中心に変更する。
- 管理者は承認前に宛先・件名・本文・金額を編集できるが、通常はボタン1回で営業メールを送信できる。
- Payment Linkは初回営業メールに自動同梱しない。返信検知が未実装のため、Payment Link送信は引き続き別の明示操作とする。

## Capabilities

### New Capabilities
- `ai-assisted-outreach-approval`: AIが営業メール送信前の承認案を作成し、管理者がワンクリックで承認送信できる状態を管理する。

### Modified Capabilities
- `outreach-sender`: 送信前にAI補助の承認案を提示し、管理者承認でその案を送信できるようにする。

## Impact

- Affected code: `src/sales/service.ts`, `src/sales/types.ts`, `src/admin/routes.ts`, `admin-ui/src/pages/runs.tsx`, admin UI tests.
- Affected APIs: existing `GET /api/admin/seo-sales/runs/:id/outreach-draft` response shape and existing `POST /api/admin/seo-sales/runs/:id/outreach/send` request path.
- Affected systems: SendGrid remains gated by existing side-effect policy; Stripe Payment Link remains separate from first outreach.
- No new external provider dependency is required.
