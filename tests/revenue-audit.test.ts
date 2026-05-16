import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { assessRevenueAudit, buildRevenueAuditPayload } from "../src/revenue-audit/assessor.js";
import { parseLlmRevenueAuditJson } from "../src/revenue-audit/schema.js";
import { generateText } from "../src/utils/llm-provider.js";
import type { Target } from "../src/types/index.js";

vi.mock("../src/utils/llm-provider.js", () => ({
  generateText: vi.fn(),
}));

const validAudit = {
  overallAssessment: "問い合わせ導線と信頼材料の改善余地があります。",
  salesPriority: "medium",
  confidence: "high",
  businessImpactSummary: "訪問者が相談前に離脱している可能性があります。",
  recommendedOffer: {
    name: "title/meta/CTA/文言改善",
    description: "検索結果とページ内の相談導線を整えます。",
    estimatedPriceRange: "3万〜5万円",
    reason: "小さく始めやすく、検出された課題と合っています。",
  },
  prioritizedFindings: [{
    title: "問い合わせ導線が弱い",
    businessImpact: "相談機会を逃している可能性があります。",
    suggestedFix: "ファーストビューと下部に相談CTAを追加します。",
    salesAngle: "無料診断の共有から会話を始めます。",
    confidence: "high",
  }],
  outreach: {
    subject: "ホームページの簡易診断について",
    firstEmail: "お世話になります。\n\n貴社のホームページを拝見し、問い合わせ導線に改善余地があると感じました。必要でしたら共有します。",
    followUpEmail: "先日の簡易診断の件で、必要でしたら要点だけお送りします。",
  },
  caveats: ["アクセス数は確認していません。"],
};

describe("revenue audit schema", () => {
  it("parses valid audit JSON", () => {
    expect(parseLlmRevenueAuditJson(JSON.stringify(validAudit))).toMatchObject({
      salesPriority: "medium",
      confidence: "high",
    });
  });

  it("parses fenced JSON", () => {
    expect(parseLlmRevenueAuditJson(`\`\`\`json\n${JSON.stringify(validAudit)}\n\`\`\``).recommendedOffer.name)
      .toBe("title/meta/CTA/文言改善");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseLlmRevenueAuditJson("not json")).toThrow(SyntaxError);
  });

  it("rejects missing required fields", () => {
    expect(() => parseLlmRevenueAuditJson(JSON.stringify({ ...validAudit, outreach: undefined }))).toThrow(z.ZodError);
  });

  it("rejects unsupported enum values", () => {
    expect(() => parseLlmRevenueAuditJson(JSON.stringify({ ...validAudit, salesPriority: "urgent" }))).toThrow(z.ZodError);
  });
});

describe("buildRevenueAuditPayload", () => {
  it("builds deterministic facts and contact-channel data", () => {
    const target: Target = {
      id: "target-1",
      url: "https://example.com",
      domain: "example.com",
      contactEmail: "info@example.com",
      industry: "税理士",
      seoScore: 82,
      diagnostics: [{ id: "meta-description", title: "Meta description", score: 0, description: "missing" }],
      opportunityScore: 64,
      opportunityFindings: [{
        category: "conversion",
        severity: "high",
        title: "問い合わせ導線が弱い",
        evidence: "CTAを検出できませんでした。",
        recommendation: "相談CTAを追加します。",
        scoreImpact: 18,
      }],
      status: "crawled",
      createdAt: 0,
      updatedAt: 0,
    };

    const payload = buildRevenueAuditPayload({ target, targetUrl: target.url });
    expect(payload).toMatchObject({
      target: {
        domain: "example.com",
        contactChannel: { type: "public_email", value: "info@example.com" },
        firstOutreachGoal: "reply_acquisition",
      },
      deterministicResearch: {
        lighthouseSeoScore: 82,
        opportunityScore: 64,
      },
    });
  });
});

describe("assessRevenueAudit", () => {
  it("requests JSON-only LLM output and validates the response", async () => {
    vi.mocked(generateText).mockResolvedValue(JSON.stringify(validAudit));
    const target: Target = {
      id: "target-1",
      url: "https://example.com",
      domain: "example.com",
      contactEmail: "info@example.com",
      seoScore: 82,
      diagnostics: [],
      opportunityScore: 64,
      opportunityFindings: [],
      status: "crawled",
      createdAt: 0,
      updatedAt: 0,
    };

    const audit = await assessRevenueAudit({ target, targetUrl: target.url });
    expect(audit.salesPriority).toBe("medium");
    expect(audit.outreach.firstEmail).toMatch(/^お世話になります。\n\n当社では、中小企業向けにホームページの改善支援を行っています。/);
    expect(audit.outreach.firstEmail).toContain("貴社のホームページを拝見し");
    expect(generateText).toHaveBeenCalledWith(
      expect.stringContaining('"deterministicResearch"'),
      expect.stringContaining("返答は必ずJSONオブジェクトのみ")
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.stringContaining('"lighthouseSeoScore": 82'),
      expect.stringContaining("再計算しない")
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("当社では、中小企業向けにホームページの改善支援を行っています。")
    );
  });
});
