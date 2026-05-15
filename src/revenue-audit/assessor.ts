import { generateText } from "../utils/llm-provider.js";
import { logger } from "../utils/logger.js";
import type { LlmRevenueAudit, Target } from "../types/index.js";
import { REVENUE_AUDIT_SYSTEM_PROMPT } from "./prompt.js";
import { parseLlmRevenueAuditJson } from "./schema.js";

export interface RevenueAuditAssessorInput {
  target: Target;
  targetUrl: string;
}

export async function assessRevenueAudit(input: RevenueAuditAssessorInput): Promise<LlmRevenueAudit> {
  const prompt = JSON.stringify(buildRevenueAuditPayload(input), null, 2);
  const raw = await generateText(prompt, REVENUE_AUDIT_SYSTEM_PROMPT);
  const audit = parseLlmRevenueAuditJson(raw);
  logger.info("LLM revenue audit generated", {
    domain: input.target.domain,
    salesPriority: audit.salesPriority,
    confidence: audit.confidence,
  });
  return audit;
}

export function buildRevenueAuditPayload(input: RevenueAuditAssessorInput): Record<string, unknown> {
  const { target, targetUrl } = input;
  return {
    instruction: "Return only JSON that matches the required schema. Use the provided facts only.",
    target: {
      url: targetUrl,
      domain: target.domain,
      industry: target.industry ?? null,
      contactChannel: target.contactEmail
        ? { type: "public_email", value: target.contactEmail }
        : { type: "unknown", value: null },
      primaryContactPolicy: "public_email_first_human_review_required",
      firstOutreachGoal: "reply_acquisition",
    },
    deterministicResearch: {
      lighthouseSeoScore: target.seoScore,
      opportunityScore: target.opportunityScore ?? null,
      diagnostics: target.diagnostics,
      opportunityFindings: target.opportunityFindings ?? [],
    },
    allowedOfferMenu: [
      { name: "簡易改善", estimatedPriceRange: "1万〜3万円" },
      { name: "title/meta/CTA/文言改善", estimatedPriceRange: "3万〜5万円" },
      { name: "トップページ改善", estimatedPriceRange: "5万〜10万円" },
      { name: "LP/導線改善", estimatedPriceRange: "8万〜15万円" },
      { name: "月額改善運用", estimatedPriceRange: "2万〜5万円" },
    ],
    outputSchema: {
      overallAssessment: "string",
      salesPriority: "low | medium | high",
      confidence: "low | medium | high",
      businessImpactSummary: "string",
      recommendedOffer: {
        name: "string",
        description: "string",
        estimatedPriceRange: "string",
        reason: "string",
      },
      prioritizedFindings: [{
        title: "string",
        businessImpact: "string",
        suggestedFix: "string",
        salesAngle: "string",
        confidence: "low | medium | high",
      }],
      outreach: {
        subject: "string",
        firstEmail: "string",
        followUpEmail: "string",
      },
      caveats: ["string"],
    },
  };
}
