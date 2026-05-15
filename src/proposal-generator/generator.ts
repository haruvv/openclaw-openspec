import { generateText } from "../utils/llm-provider.js";
import { logger } from "../utils/logger.js";
import type { Target } from "../types/index.js";

const SYSTEM_PROMPT = `あなたはSEOコンサルタントです。クライアント企業のウェブサイトのSEO診断結果をもとに、具体的で実行可能な改善提案書を作成します。
提案書は必ず以下の3セクションで構成してください：
1. ## 現状スコア
2. ## 課題一覧
3. ## 改善提案（優先度付き）

専門的かつ親切な口調で、クライアントが自社の課題を理解しやすいよう記述してください。`;

export async function generateProposal(target: Target): Promise<string> {
  const opportunityLines = (target.opportunityFindings ?? [])
    .map((finding) => `- [${finding.severity}/${finding.category}] ${finding.title}: ${finding.evidence} → ${finding.recommendation}`)
    .join("\n");
  const diagnosticLines = target.diagnostics
    .map((d) => `- ${d.title}: ${d.score === null ? "未計測" : Math.round((d.score ?? 0) * 100) + "点"}（${d.description}）`)
    .join("\n");

  const userMessage = `以下のSEO診断結果をもとに改善提案書を作成してください。

企業名/ドメイン: ${target.domain}
業種: ${target.industry ?? "不明"}
Lighthouse SEOスコア: ${target.seoScore}/100
改善余地スコア: ${target.opportunityScore ?? "未計測"}/100

営業上の改善余地:
${opportunityLines || "- 改善余地 findings はありません。Lighthouse診断項目を中心に提案してください。"}

Lighthouse診断項目:
${diagnosticLines}`;

  const proposal = await generateText(userMessage, SYSTEM_PROMPT);
  validateProposal(proposal);
  return proposal;
}

function validateProposal(text: string): void {
  const required = ["## 現状スコア", "## 課題一覧", "## 改善提案"];
  const missing = required.filter((s) => !text.includes(s));
  if (missing.length > 0) {
    logger.warn("Proposal missing required sections", { missing });
  }
}
