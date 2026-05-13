## MODIFIED Requirements

### Requirement: 業種・URLリストからサイトをクロールする
システムは、指定された業種キーワードまたはURLリストを入力として受け取り、Firecrawl APIを使って各サイトのHTMLコンテンツを取得しなければならない（SHALL）。

#### Scenario: URLリストを入力してクロールが成功する
- **WHEN** 有効なURLのリストがシステムに渡される
- **THEN** Firecrawl APIが各URLのコンテンツを取得し、HTMLとメタデータを返す

#### Scenario: 無効なURLが含まれる場合はスキップする
- **WHEN** URLリストに無効なURL（404、タイムアウト等）が含まれる
- **THEN** 該当URLをスキップしてエラーログに記録し、残りのURLの処理を続行する

### Requirement: LighthouseでSEOスコアを測定する
システムは、クロールで取得した各サイトに対してLighthouse CLIを実行し、SEOカテゴリのスコア（0〜100）を取得しなければならない（SHALL）。

#### Scenario: SEOスコアの取得に成功する
- **WHEN** クロール済みのURLに対してLighthouse測定を実行する
- **THEN** SEOカテゴリスコアと主要な診断項目（title欠落、meta description欠落、canonical未設定等）が返される

#### Scenario: Lighthouse測定がタイムアウトする
- **WHEN** 測定開始から30秒以内にLighthouseが完了しない
- **THEN** そのURLをタイムアウトとしてスキップし、エラーログに記録する

### Requirement: スコアが閾値以下のサイトをフィルタリングしてリスト化する
システムは、SEOスコアが設定値（デフォルト: 50）以下のサイトを抽出し、ターゲットリストとして出力しなければならない（SHALL）。

#### Scenario: 低スコアサイトのフィルタリング
- **WHEN** 測定完了後にフィルタリングを実行する
- **THEN** SEOスコア ≤ 50 のサイトのURL・スコア・診断項目が一覧として返される

#### Scenario: 全サイトが閾値を超えている
- **WHEN** 測定した全サイトのSEOスコアが閾値を上回る
- **THEN** 空のリストを返し、「ターゲットなし」のステータスをログに記録する

### Requirement: 1回のバッチで処理するサイト数を制限する
システムは、1バッチあたりのクロール対象URLを最大50件に制限しなければならない（SHALL）。

#### Scenario: 50件を超えるURLが入力される
- **WHEN** 51件以上のURLがシステムに渡される
- **THEN** 最初の50件のみ処理し、残りは次のバッチ用にキューに保持する
