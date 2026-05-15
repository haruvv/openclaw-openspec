import { describe, it, expect, vi } from "vitest";

vi.mock("../src/utils/llm-provider.js", () => ({
  generateText: vi.fn().mockResolvedValue(
    "## 調査結果の要点\nスコア: 30/100\n\n## メール提案文\n件名案と本文案\n\n## 提案の補足ポイント\n1. titleタグを追加する"
  ),
}));

import { generateProposal } from "../src/proposal-generator/generator.js";
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
});
