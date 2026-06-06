## Why

SEO営業のサイト探索では、対象サイトに公開メールアドレスが掲載されていないケースが多く、現状のクロール中心の連絡手段探索では有望な候補が `missing_contact_email` で落ちやすい。外部メール探索サービスを使いつつ、営業禁止表示、個人メール、個人ドメイン、推測メール、配信停止要求を送信前に抑止する必要がある。

## What Changes

- Hunter.io Domain Search を使って、サイトドメインに紐づく法人・事業用メール候補を探索する。
- 任意の Apollo.io fallback を追加し、Hunter で十分な候補が見つからない場合だけ役職・業務関連性のある候補を探索する。
- メール候補をコンプライアンス判定し、個人メール、個人ドメイン、営業禁止表示、配信停止済み、低関連性の候補を除外または低優先度化する。
- 推測・accept-all・未検証メールは低信頼度にし、人間承認なしに送信対象へ昇格しない。
- アウトリーチ本文には送信者情報と配信停止手段を必ず含める。
- 「今後連絡不要」などの明示的な拒否は抑止リストに登録し、以後の送信候補から除外する。
- 初回は人間承認を必須とし、自動送信やフォーム/DM/手動対応の新規実装は行わない。

## Capabilities

### New Capabilities
- `compliant-email-discovery`: Hunter/Apollo による事業用メール探索、候補スクリーニング、抑止リスト、送信前コンプライアンス判定を扱う。

### Modified Capabilities
- `site-crawler`: 公開メールが見つからない場合、許可された外部メール探索を連絡手段探索に組み込む。
- `outreach-sender`: 人間承認済みメールでも送信前に抑止リスト、営業禁止、送信者情報、配信停止文言を検証する。

## Impact

- Affected code: `src/site-crawler`, `src/discovery/contact-routing.ts`, `src/sales/service.ts`, `src/sales/repository.ts`, `src/storage/sqlite.ts`, admin API/UI draft display.
- New integration points: Hunter.io API key, optional Apollo.io API key, provider base URL overrides for tests.
- Data storage: suppression entries for domains/emails and provider-derived email evidence metadata.
- Tests: provider parsing, compliance filtering, crawler fallback, outreach send blocking, suppression persistence.
