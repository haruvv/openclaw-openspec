## 1. 依存パッケージの更新

- [x] 1.1 `@google/generative-ai` を `package.json` に追加する
- [x] 1.2 `npm install` を実行して依存を解決する

## 2. llm-provider モジュールの実装

- [x] 2.1 `src/utils/llm-provider.ts` を新規作成し、`generateText(prompt, systemPrompt)` インターフェースを定義する
- [x] 2.2 Gemini（`gemini-1.5-flash`）のクライアントを実装しプライマリ呼び出しを追加する
- [x] 2.3 Gemini が 429 を返した場合に Z.ai Anthropic互換エンドポイントへフォールバックするロジックを実装する
- [x] 2.4 `ZAI_API_KEY` 未設定時は警告ログを出して 429 エラーをそのまま throw する処理を追加する

## 3. proposal-generator の修正

- [x] 3.1 `src/proposal-generator/generator.ts` の Anthropic SDK 直呼び出しを `llm-provider` の `generateText` 経由に変更する
- [x] 3.2 `@anthropic-ai/sdk` のインポートを `generator.ts` から削除する

## 4. 設定ファイルの更新

- [x] 4.1 `.env.example` に `GEMINI_API_KEY` と `ZAI_API_KEY` を追加し、`ANTHROPIC_API_KEY` をコメントアウトする

## 5. テストの更新

- [x] 5.1 `tests/proposal-generator.test.ts` のモックを `@anthropic-ai/sdk` から `../src/utils/llm-provider.js` に差し替える
- [x] 5.2 `tests/llm-provider.test.ts` を新規作成し、Gemini 成功・429フォールバック・ZAI_KEY未設定の3ケースをテストする
- [x] 5.3 `npm test` を実行して全テストがパスすることを確認する
