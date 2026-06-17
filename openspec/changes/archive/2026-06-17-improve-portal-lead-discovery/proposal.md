## Why

SEO営業の候補探索はGoogle Mapsが主軸になっているが、業種によってはMapsだけでは公式サイトURLが不足し、地域ポータルや業界ポータル上の掲載情報から候補サイトを補う必要がある。Programmable Search Engine は全Web検索ではなく指定サイト検索として扱うべきなので、ポータル探索を明示的な一次ソースとして設計する。

## What Changes

- 業界ポータル探索を専用のリード探索ソースとして追加する。
- 業種ごとに対象ポータル、検索パターン、候補抽出ルールを設定できるようにする。
- ポータル掲載ページから公式サイトURL、事業名、所在地、電話番号、カテゴリなどを候補として抽出する。
- 公式サイトURLが見つからない掲載ページは、ポータルプロフィール候補として保留し、直接SEO解析対象にしない。
- Google Maps候補とポータル候補を同一事業として統合できるよう、名称・所在地・電話番号・公式サイトURLの来歴を保持する。
- 管理画面でポータル探索の有効/無効、対象ポータル、地域指定を確認できるようにする。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `lead-source-discovery`: 業界ポータル探索ソース、ポータル候補の正規化、公式サイトURL抽出、ポータルプロフィール保留、Maps候補との統合要件を追加する。

## Impact

- Affected code: `src/discovery/adapters.ts`, `src/discovery/types.ts`, `src/discovery/normalization.ts`, `src/discovery/job.ts`, admin discovery settings UI.
- New configuration: portal source enablement, portal target definitions, optional portal URL allowlist/domain list.
- External services: Firecrawl can be reused for portal page fetch/search when configured; direct HTTP parsing may be used for simple portal pages.
- Tests: portal adapter parsing, URL extraction, profile-only holding, Maps/profile merge, UI settings/default source behavior.
