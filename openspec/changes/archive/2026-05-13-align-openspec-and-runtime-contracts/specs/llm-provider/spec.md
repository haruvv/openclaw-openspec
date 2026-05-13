## MODIFIED Requirements

### Requirement: Gemini をプライマリ LLM として使用する
システムは、テキスト生成リクエストを `gemini-1.5-flash` モデルに送信しなければならない（SHALL）。MCP実行環境は `GEMINI_API_KEY` をLLM生成用のプライマリ資格情報として渡さなければならない（SHALL）。

#### Scenario: Gemini でテキスト生成が成功する
- **WHEN** `GEMINI_API_KEY` が設定されており、Gemini API が正常なレスポンスを返す
- **THEN** 生成されたテキストが返される

### Requirement: Gemini がクォータ超過した場合に Z.ai GLM へフォールバックする
システムは、Gemini API が HTTP 429 を返した場合に限り、Z.ai の Anthropic互換エンドポイント経由で GLM モデルを呼び出しフォールバックしなければならない（SHALL）。MCP実行環境は任意のフォールバック資格情報として `ZAI_API_KEY` を渡せなければならない（SHALL）。

#### Scenario: 429 受信後に Z.ai へフォールバックする
- **WHEN** Gemini API が 429 エラーを返し、`ZAI_API_KEY` が設定されている
- **THEN** Z.ai GLM モデルへ同一プロンプトで再リクエストし、その結果を返す

#### Scenario: ZAI_API_KEY 未設定でフォールバックしない
- **WHEN** Gemini API が 429 エラーを返し、`ZAI_API_KEY` が未設定
- **THEN** 警告をログに記録し、429 エラーをそのまま throw する

### Requirement: 429 以外のエラーはフォールバックせずに throw する
システムは、Gemini API が 429 以外のエラー（認証失敗・ネットワーク障害など）を返した場合、Z.ai へのフォールバックを行わずにエラーを throw しなければならない（SHALL）。

#### Scenario: 認証エラーはフォールバックしない
- **WHEN** Gemini API が 401 または 403 エラーを返す
- **THEN** フォールバックせずにエラーを throw する
