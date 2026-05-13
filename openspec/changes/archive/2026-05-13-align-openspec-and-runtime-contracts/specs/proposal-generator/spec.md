## MODIFIED Requirements

### Requirement: Lighthouse診断結果をもとにSEO改善提案書を生成する
システムは、サイトクローラーが出力したターゲットリスト（URL・スコア・診断項目）を入力として受け取り、`llm-provider` モジュール経由で LLM を呼び出して企業ごとにパーソナライズされたSEO改善提案書をMarkdown形式で生成しなければならない（SHALL）。使用する LLM プロバイダーは `llm-provider` が決定し、`proposal-generator` はプロバイダーを意識しない。

#### Scenario: 提案書の生成に成功する
- **WHEN** ターゲット企業のURL・SEOスコア・診断項目がシステムに渡される
- **THEN** 企業名・業種・具体的な改善箇所を含むMarkdown提案書が生成される

#### Scenario: 診断項目が不足している場合
- **WHEN** Lighthouse診断結果が1項目しか含まれていない
- **THEN** 利用可能な情報のみで提案書を生成し、「詳細情報不足」の注記を追加する
