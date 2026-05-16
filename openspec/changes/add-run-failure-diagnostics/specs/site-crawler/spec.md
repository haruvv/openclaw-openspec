## MODIFIED Requirements

### Requirement: LighthouseでSEOスコアを測定する
システムは、クロールで取得した各サイトに対してLighthouse CLIを実行し、SEOカテゴリのスコア（0〜100）を取得しなければならない（SHALL）。Lighthouse測定が失敗した場合、システムは失敗理由を構造化して記録し、クロール済みHTMLが利用可能であれば crawl-only fallback により対象サイトの分析を継続しなければならない（MUST）。

#### Scenario: SEOスコアの取得に成功する
- **WHEN** クロール済みのURLに対してLighthouse測定を実行する
- **THEN** SEOカテゴリスコアと主要な診断項目（title欠落、meta description欠落、canonical未設定等）が返される

#### Scenario: Lighthouse測定がタイムアウトする
- **WHEN** 測定開始から設定されたLighthouse timeout以内にLighthouseが完了しない
- **THEN** システムは timeout を構造化された失敗理由として記録する
- **AND** クロール済みHTMLが利用可能であれば `lighthouse-unavailable` 診断を付与して crawl-only fallback analysis を継続する

#### Scenario: Lighthouseプロセスが失敗する
- **WHEN** Lighthouse CLIまたはChromium起動がエラー終了する
- **THEN** システムは process failure、exit code、stderrの安全な抜粋を失敗理由として記録する
- **AND** クロール済みHTMLが利用可能であれば `lighthouse-unavailable` 診断を付与して crawl-only fallback analysis を継続する

### Requirement: スコアが閾値以下のサイトをフィルタリングしてリスト化する
システムは、既存の Lighthouse SEOスコア閾値に加えて、改善余地スコアに基づいて営業対象サイトを抽出し、ターゲットリストとして出力しなければならない（SHALL）。Lighthouse SEOスコアが高いサイトでも、`opportunityScore` が設定値以上であればターゲットに含めなければならない（MUST）。ターゲットから除外したURLは、除外理由を構造化して返さなければならない（MUST）。

#### Scenario: 低スコアサイトのフィルタリング
- **WHEN** 測定完了後にフィルタリングを実行する
- **THEN** SEOスコア ≤ 50 のサイトのURL・スコア・診断項目・改善余地スコア・改善余地 findings が一覧として返される

#### Scenario: Lighthouseスコアは高いが改善余地が大きい
- **WHEN** Lighthouse SEOスコアが閾値を上回るが `opportunityScore` が設定値以上のサイトを分析する
- **THEN** システムはそのサイトをターゲットリストに含め、改善余地 findings を返す

#### Scenario: 全サイトの改善余地が小さい
- **WHEN** 測定した全サイトのSEOスコアが閾値を上回り、かつ `opportunityScore` が設定値未満である
- **THEN** 空のリストを返し、「ターゲットなし」のステータスをログに記録する
- **AND** 各URLの除外理由を `opportunity` stage の skip detail として返す
