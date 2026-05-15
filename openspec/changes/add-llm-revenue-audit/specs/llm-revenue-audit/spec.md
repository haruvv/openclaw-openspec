## ADDED Requirements

### Requirement: ルールベース調査結果をLLM営業評価に変換する
システムは、決定論的なSEO調査結果を入力として受け取り、LLMプロバイダー経由で営業判断用の構造化評価を生成しなければならない（SHALL）。LLMはLighthouse SEOスコア、改善余地スコア、診断項目、検出済みfindingを再計算してはならない（SHALL NOT）。

#### Scenario: LLM営業評価の生成に成功する
- **WHEN** クロール、Lighthouse測定、改善余地スコアリングが成功し、LLM資格情報が設定されている
- **THEN** システムはURL、業種ヒント、スコア、診断項目、改善余地findingをLLMへ渡す
- **AND** `overallAssessment`、`salesPriority`、`confidence`、`businessImpactSummary`、`recommendedOffer`、`prioritizedFindings`、`outreach`、`caveats` を含む構造化評価を生成する

#### Scenario: LLM営業評価は事実を作らない
- **WHEN** 入力にない会社情報、売上、アクセス数、実績情報が必要になる
- **THEN** システムはLLM出力に断定的な事実として保存してはならない
- **AND** 不確実な内容は `caveats` または低い `confidence` として表現される

### Requirement: LLM営業評価を検証して保存する
システムは、LLM営業評価の出力をJSONとして解析し、保存前に固定スキーマで検証しなければならない（SHALL）。検証済みの評価は実行サマリーの `llmRevenueAudit` として保存しなければならない（SHALL）。

#### Scenario: スキーマ検証済みの評価を保存する
- **WHEN** LLMが有効な営業評価JSONを返す
- **THEN** システムは `summary.llmRevenueAudit` に評価結果を保存する
- **AND** 管理画面の実行詳細APIレスポンスで同じ評価を参照できる

#### Scenario: 既存実行は営業評価なしでも表示できる
- **WHEN** 既存の実行サマリーに `llmRevenueAudit` が存在しない
- **THEN** 管理画面は実行詳細をエラーにせず表示する
- **AND** 営業評価は未生成として扱われる

### Requirement: LLM営業評価の失敗は非致命的に扱う
システムは、LLM営業評価の生成、JSON解析、またはスキーマ検証に失敗した場合でも、クロール、SEO診断、改善余地スコア、提案書生成の成功結果を破棄してはならない（SHALL NOT）。

#### Scenario: LLM営業評価に失敗しても実行結果は残る
- **WHEN** LLM営業評価ステップが失敗する
- **THEN** システムは該当ステップを `failed` または `skipped` として記録する
- **AND** 決定論的な調査結果と生成済み提案書は実行詳細に表示される

### Requirement: 管理画面で営業評価を調査結果と分けて表示する
システムは、実行詳細画面でLLM営業評価を `営業評価` として表示し、`調査結果` および `営業提案書` から区別しなければならない（SHALL）。

#### Scenario: 営業評価がある実行詳細を表示する
- **WHEN** 実行サマリーに `llmRevenueAudit` が存在する
- **THEN** 管理画面は営業優先度、信頼度、事業影響の要約、推奨オファー、初回接触文面、注意事項を表示する

#### Scenario: 営業評価がない実行詳細を表示する
- **WHEN** 実行サマリーに `llmRevenueAudit` が存在しない
- **THEN** 管理画面は調査結果と営業提案書を従来通り表示し、営業評価が未生成であることを示す
