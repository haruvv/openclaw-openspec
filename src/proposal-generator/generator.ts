import { generateText } from "../utils/llm-provider.js";
import { logger } from "../utils/logger.js";
import type { Target } from "../types/index.js";

const SYSTEM_PROMPT = `あなたはSEOコンサルタント兼営業担当です。クライアント企業のウェブサイトのSEO診断結果をもとに、営業メールでそのまま提案しやすい改善提案書を作成します。
提案書は必ず以下の3セクションで構成してください：
1. ## 調査結果の要点
2. ## メール提案文
3. ## 提案の補足ポイント

調査結果そのものの羅列ではなく、相手に送る提案として自然な文面にしてください。専門的かつ親切な口調で、相手が自社の課題と次の行動を理解しやすいよう記述してください。`;

export async function generateProposal(target: Target): Promise<string> {
  const opportunityLines = (target.opportunityFindings ?? [])
    .map((finding) => `- [${finding.severity}/${finding.category}] ${finding.title}: ${finding.evidence} → ${finding.recommendation}`)
    .join("\n");
  const diagnosticLines = target.diagnostics
    .map((d) => `- ${d.title}: ${d.score === null ? "未計測" : Math.round((d.score ?? 0) * 100) + "点"}（${d.description}）`)
    .join("\n");

  const userMessage = `以下のSEO診断結果をもとに、営業メールでどのように提案するかが分かる提案書を作成してください。

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
  const required = ["## 調査結果の要点", "## メール提案文", "## 提案の補足ポイント"];
  const missing = required.filter((s) => !text.includes(s));
  if (missing.length > 0) {
    logger.warn("Proposal missing required sections", { missing });
  }
}
