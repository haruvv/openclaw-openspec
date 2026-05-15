import { describe, it, expect, vi } from "vitest";

vi.mock("../src/utils/llm-provider.js", () => ({
  generateText: vi.fn().mockResolvedValue(
    "## 調査結果の要点\nスコア: 30/100\n\n## メール提案文\n件名案と本文案\n\n## 提案の補足ポイント\n1. titleタグを追加する"
  ),
}));

import { generateProposal } from "../src/proposal-generator/generator.js";
import { generateText } from "../src/utils/llm-provider.js";
import type { Target } from "../src/types/index.js";

const mockTarget: Target = {
  id: "test-id",
  url: "https://example.com",
  domain: "example.com",
  seoScore: 30,
  diagnostics: [{ id: "document-title", title: "Document lacks title", score: 0, description: "" }],
  status: "crawled",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("generateProposal", () => {
  it("returns proposal with required sections", async () => {
    const proposal = await generateProposal(mockTarget);
    expect(proposal).toContain("## 調査結果の要点");
    expect(proposal).toContain("## メール提案文");
    expect(proposal).toContain("## 提案の補足ポイント");
  });

  it("passes LLM revenue audit context into proposal generation", async () => {
    await generateProposal({
      ...mockTarget,
      llmRevenueAudit: {
        overallAssessment: "問い合わせ導線に改善余地があります。",
        salesPriority: "high",
        confidence: "medium",
        businessImpactSummary: "相談機会を逃している可能性があります。",
        recommendedOffer: {
          name: "CTA改善",
          description: "問い合わせ導線を整えます。",
          estimatedPriceRange: "3万〜5万円",
          reason: "検出された課題に合っています。",
        },
        prioritizedFindings: [],
        outreach: {
          subject: "簡易診断のご共有について",
          firstEmail: "もし必要であれば要点だけ共有します。",
          followUpEmail: "先日の件で必要でしたらお送りします。",
        },
        caveats: ["アクセス数は未確認です。"],
      },
    });

    expect(generateText).toHaveBeenLastCalledWith(
      expect.stringContaining("LLM営業評価"),
      expect.any(String)
    );
    expect(generateText).toHaveBeenLastCalledWith(
      expect.stringContaining("CTA改善"),
      expect.stringContaining("返信獲得が目的")
    );
  });
});
