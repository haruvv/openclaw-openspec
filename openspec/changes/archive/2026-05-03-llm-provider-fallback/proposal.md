## Why

`proposal-generator` は現在 Anthropic Claude API に固定されており、コストが高い。Gemini の無料枠をプライマリとし、クォータ超過時に Z.ai（GLM）へ自動フォールバックすることで、コストを抑えながら可用性を維持する。

## What Changes

- **修正**: `proposal-generator` の LLM 呼び出しをプロバイダー抽象レイヤー経由に変更する
- **新規**: Gemini（`gemini-1.5-flash`）をプライマリプロバイダーとして追加する
- **新規**: Z.ai GLM（Anthropic互換エンドポイント）をフォールバックプロバイダーとして追加する
- **修正**: Anthropic Claude は削除し、Z.ai 経由の GLM に置き換える
- **修正**: 環境変数に `GEMINI_API_KEY` と `ZAI_API_KEY` を追加する

## Capabilities

### New Capabilities

- `llm-provider`: 複数の LLM プロバイダーを抽象化し、プライマリ失敗時にフォールバックするレイヤー

### Modified Capabilities

- `proposal-generator`: LLM 呼び出しを直接 Anthropic SDK から `llm-provider` 経由に変更する（フォールバック対応のため要件が変わる）

## Impact

- **変更ファイル**: `src/proposal-generator/generator.ts`
- **新規ファイル**: `src/utils/llm-provider.ts`
- **環境変数**: `GEMINI_API_KEY`（必須）、`ZAI_API_KEY`（フォールバック用、任意）、`ANTHROPIC_API_KEY` は不要になる
- **新規依存**: `@google/generative-ai`
- **削除依存**: `@anthropic-ai/sdk`（proposal-generator での直接利用のみ削除）
