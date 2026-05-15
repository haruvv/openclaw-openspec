## ADDED Requirements

### Requirement: クロール結果に改善余地スコアを含める
システムは、各ターゲットのクロール結果に Lighthouse SEOスコア、`opportunityScore`、構造化 opportunity findings を含めなければならない（SHALL）。

#### Scenario: サイト分析結果に両方のスコアが含まれる
- **WHEN** URLのクロールとスコアリングが成功する
- **THEN** 出力されるターゲットには `seoScore`、`opportunityScore`、`opportunityFindings` が含まれる

#### Scenario: 既存のLighthouse診断を保持する
- **WHEN** opportunity scoring が追加された後にURLを分析する
- **THEN** 既存の Lighthouse 診断項目は `diagnostics` として引き続き返される

## MODIFIED Requirements

### Requirement: スコアが閾値以下のサイトをフィルタリングしてリスト化する
システムは、既存の Lighthouse SEOスコア閾値に加えて、改善余地スコアに基づいて営業対象サイトを抽出し、ターゲットリストとして出力しなければならない（SHALL）。Lighthouse SEOスコアが高いサイトでも、`opportunityScore` が設定値以上であればターゲットに含めなければならない（MUST）。

#### Scenario: 低スコアサイトのフィルタリング
- **WHEN** 測定完了後にフィルタリングを実行する
- **THEN** SEOスコア ≤ 50 のサイトのURL・スコア・診断項目・改善余地スコア・改善余地 findings が一覧として返される

#### Scenario: Lighthouseスコアは高いが改善余地が大きい
- **WHEN** Lighthouse SEOスコアが閾値を上回るが `opportunityScore` が設定値以上のサイトを分析する
- **THEN** システムはそのサイトをターゲットリストに含め、改善余地 findings を返す

#### Scenario: 全サイトの改善余地が小さい
- **WHEN** 測定した全サイトのSEOスコアが閾値を上回り、かつ `opportunityScore` が設定値未満である
- **THEN** 空のリストを返し、「ターゲットなし」のステータスをログに記録する
