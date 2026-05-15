## MODIFIED Requirements

### Requirement: Lighthouse診断結果をもとにSEO改善提案書を生成する
システムは、サイトクローラーが出力したターゲットリスト（URL・Lighthouse SEOスコア・改善余地スコア・診断項目・opportunity findings）を入力として受け取り、`llm-provider` モジュール経由で LLM を呼び出して企業ごとにパーソナライズされたSEO改善提案書をMarkdown形式で生成しなければならない（SHALL）。使用する LLM プロバイダーは `llm-provider` が決定し、`proposal-generator` はプロバイダーを意識しない。

#### Scenario: 提案書の生成に成功する
- **WHEN** ターゲット企業のURL・SEOスコア・改善余地スコア・診断項目・opportunity findings がシステムに渡される
- **THEN** 企業名・業種・具体的な改善箇所・改善余地の根拠を含むMarkdown提案書が生成される

#### Scenario: Lighthouse SEOスコアが高い場合
- **WHEN** Lighthouse SEOスコアが高く、opportunity findings にコンテンツやCV導線の改善余地が含まれる
- **THEN** 提案書は Lighthouse スコアの高さを否定せず、検索流入や問い合わせ獲得に向けた改善余地を中心に説明する

#### Scenario: 診断項目が不足している場合
- **WHEN** Lighthouse診断結果が1項目しか含まれていないが opportunity findings が存在する
- **THEN** 利用可能な Lighthouse 情報と opportunity findings を使って提案書を生成し、「詳細情報不足」の注記を追加する
