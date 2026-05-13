import { describe, it, expect, vi } from "vitest";

vi.mock("../src/utils/llm-provider.js", () => ({
  generateText: vi.fn().mockResolvedValue(
    "## 現状スコア\nスコア: 30/100\n\n## 課題一覧\n- title欠落\n\n## 改善提案（優先度付き）\n1. titleタグを追加する"
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
    expect(proposal).toContain("## 現状スコア");
    expect(proposal).toContain("## 課題一覧");
    expect(proposal).toContain("## 改善提案");
  });
});
