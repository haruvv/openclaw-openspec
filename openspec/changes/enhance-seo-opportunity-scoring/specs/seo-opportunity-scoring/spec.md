## ADDED Requirements

### Requirement: SEO改善余地スコアを算出する
システムは、Lighthouse SEOスコアとは別に、営業対象としての改善余地を表す `opportunityScore` を0〜100で算出しなければならない（SHALL）。`opportunityScore` は高いほど改善余地と営業優先度が高いことを表さなければならない（MUST）。

#### Scenario: Lighthouse SEOが高いサイトにも改善余地を付与する
- **WHEN** Lighthouse SEOスコアが100のサイトに、薄い本文、弱いCTA、信頼要素不足などの改善余地がある
- **THEN** システムは `seoScore=100` を保持しつつ、改善余地に応じた `opportunityScore` と findings を返す

#### Scenario: 改善余地が少ないサイトを低優先度にする
- **WHEN** 技術SEO、コンテンツ、検索意図、CV導線、信頼要素が十分に揃っているサイトを分析する
- **THEN** システムは低い `opportunityScore` と低優先度の findings を返す

### Requirement: 改善余地の根拠を構造化して返す
システムは、改善余地の根拠を `category`、`severity`、`title`、`evidence`、`recommendation`、`scoreImpact` を含む構造化 finding として返さなければならない（SHALL）。

#### Scenario: コンテンツ不足を検出する
- **WHEN** 対象ページの本文量やサービス説明が不足している
- **THEN** システムは `content` カテゴリの finding と、画面・提案書に使える根拠と推奨改善を返す

#### Scenario: CV導線不足を検出する
- **WHEN** 対象ページに問い合わせ、予約、相談、資料請求などの明確な導線がない
- **THEN** システムは `conversion` カテゴリの finding と、改善推奨を返す

### Requirement: 複数カテゴリで改善余地を評価する
システムは、少なくとも `technical`、`content`、`intent`、`conversion`、`trust` のカテゴリで改善余地を評価しなければならない（SHALL）。

#### Scenario: カテゴリ別の弱点を集計する
- **WHEN** 対象ページを分析する
- **THEN** システムはカテゴリごとの findings を生成し、総合 `opportunityScore` の根拠として利用する

### Requirement: 改善余地スコアは決定的に再計算できる
システムは、同じHTML、メタデータ、Lighthouse結果を入力した場合、同じ `opportunityScore` と findings を返さなければならない（MUST）。

#### Scenario: 同じ入力を再分析する
- **WHEN** 同一のクロール結果とLighthouse結果でスコアリングを2回実行する
- **THEN** システムは同一の `opportunityScore` と同一の finding セットを返す
