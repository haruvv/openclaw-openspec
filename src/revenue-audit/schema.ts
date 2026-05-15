import { z } from "zod";
import type { LlmRevenueAudit } from "../types/index.js";

const confidenceSchema = z.enum(["low", "medium", "high"]);

export const llmRevenueAuditSchema = z.object({
  overallAssessment: z.string().min(1),
  salesPriority: z.enum(["low", "medium", "high"]),
  confidence: confidenceSchema,
  businessImpactSummary: z.string().min(1),
  recommendedOffer: z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    estimatedPriceRange: z.string().min(1),
    reason: z.string().min(1),
  }).strict(),
  prioritizedFindings: z.array(z.object({
    title: z.string().min(1),
    businessImpact: z.string().min(1),
    suggestedFix: z.string().min(1),
    salesAngle: z.string().min(1),
    confidence: confidenceSchema,
  }).strict()).default([]),
  outreach: z.object({
    subject: z.string().min(1),
    firstEmail: z.string().min(1),
    followUpEmail: z.string().min(1),
  }).strict(),
  caveats: z.array(z.string().min(1)).default([]),
}).strict();

export function parseLlmRevenueAudit(value: unknown): LlmRevenueAudit {
  return llmRevenueAuditSchema.parse(value);
}

export function parseLlmRevenueAuditJson(text: string): LlmRevenueAudit {
  return parseLlmRevenueAudit(JSON.parse(extractJsonObject(text)));
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}
