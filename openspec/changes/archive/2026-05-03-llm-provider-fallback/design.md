## Context

`proposal-generator` は現在 `@anthropic-ai/sdk` を直接使用しており、プロバイダーが1つに固定されている。Gemini の無料枠（`gemini-1.5-flash`、1分60リクエスト）をプライマリとし、クォータ超過（HTTP 429）時に Z.ai の Anthropic互換エンドポイント（GLM）へ自動フォールバックする抽象レイヤーを導入する。

## Goals / Non-Goals

**Goals:**
- Gemini をプライマリ LLM プロバイダーとして使用し、コストをゼロに近づける
- 429 / quota exceeded 時に Z.ai GLM へ自動フォールバックする
- `generator.ts` の呼び出し側コードを変更しない（抽象レイヤーで吸収）

**Non-Goals:**
- 3つ以上のプロバイダーチェーン
- プロバイダーごとのプロンプト最適化
- ストリーミングレスポンス対応

## Decisions

### D1: プロバイダー抽象を `src/utils/llm-provider.ts` に集約する

**選択**: `generateText(prompt, systemPrompt)` という共通インターフェースを持つ単一モジュールに実装する

**理由**: `generator.ts` の変更を最小限にでき、将来プロバイダーを追加・変更しやすい。

---

### D2: Z.ai は Anthropic互換エンドポイントで呼び出す

**選択**: `@anthropic-ai/sdk` の `baseURL` を `https://api.z.ai/api/anthropic` に差し替える

**理由**: Z.ai は Anthropic互換 API を提供しており、SDK を再利用できる。別の SDK を追加する必要がない。

---

### D3: フォールバック条件は HTTP 429 のみとする

**選択**: Gemini が `429 Too Many Requests` を返した場合のみ Z.ai にフォールバックする

**理由**: 429 以外のエラー（認証失敗・ネットワーク障害など）はフォールバックしても解決しないため、即座にエラーとして返す。

---

### D4: `ZAI_API_KEY` は任意とし、未設定の場合はフォールバックしない

**選択**: `ZAI_API_KEY` が未設定の場合、Gemini のエラーをそのまま throw する

**理由**: フォールバック先がなければ設定しなくてよい。MVP 段階では Gemini 単体でも十分。

## Risks / Trade-offs

| リスク | 緩和策 |
|---|---|
| Gemini の無料枠レート制限（1分60リクエスト）が想定外に低い | バッチサイズを小さく保つ（既存の50件制限が有効） |
| Z.ai の Anthropic互換 API の挙動差異 | プロンプトを変えていないため基本的に問題なし。出力フォーマットは `validateProposal` で検証済み |
| `ZAI_API_KEY` 未設定でフォールバックが無効になる | ログに警告を出してユーザーに知らせる |

## Migration Plan

1. `@google/generative-ai` パッケージを追加
2. `src/utils/llm-provider.ts` を新規作成
3. `src/proposal-generator/generator.ts` を `llm-provider` 経由に変更
4. `.env.example` を更新（`GEMINI_API_KEY` 追加、`ANTHROPIC_API_KEY` をコメントアウト）
5. テストのモックを `llm-provider` に向け直す

ロールバック: `generator.ts` を元の Anthropic SDK 直呼び出しに戻すだけ。
