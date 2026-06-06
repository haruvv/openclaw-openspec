import type { ContactMethod, SeoOpportunityFinding } from "../types/index.js";
import type { BusinessSiteQualification, LeadPriorityScore, SiteCandidate, SourceConfidence } from "./types.js";

export interface ScoreLeadPriorityInput {
  candidate?: SiteCandidate;
  seoScore?: number;
  opportunityScore?: number;
  opportunityFindings?: SeoOpportunityFinding[];
  businessQualification?: BusinessSiteQualification;
  contactMethods?: ContactMethod[];
  duplicateOrCooldown?: boolean;
  manualCapacityAvailable?: boolean;
}

export function scoreLeadPriority(input: ScoreLeadPriorityInput): LeadPriorityScore {
  const seoSeverity = scoreSeoSeverity(input.seoScore, input.opportunityScore, input.opportunityFindings ?? []);
  const businessFit = input.businessQualification?.status === "passed" ? confidenceScore(input.businessQualification.confidence) : 0;
  const sourceConfidence = confidenceScore(input.candidate?.sourceConfidence ?? "low");
  const sourceConfirmation = Math.min(15, Math.max(0, ((input.candidate?.sourceProvenance.length ?? 1) - 1) * 5 + 5));
  const contactability = scoreContactability(input.contactMethods ?? []);
  const operationalFit = input.duplicateOrCooldown ? 0 : input.manualCapacityAvailable === false ? 5 : 15;
  const total = clampScore(seoSeverity + businessFit + sourceConfidence + sourceConfirmation + contactability + operationalFit);
  const reasons = [
    `seo:${seoSeverity}`,
    `business:${businessFit}`,
    `source:${sourceConfidence}`,
    `confirmation:${sourceConfirmation}`,
    `contact:${contactability}`,
    `operational:${operationalFit}`,
  ];
  return {
    total,
    label: total >= 70 ? "high" : total >= 40 ? "medium" : "low",
    components: { seoSeverity, businessFit, sourceConfidence, sourceConfirmation, contactability, operationalFit },
    reasons,
  };
}

function scoreSeoSeverity(seoScore: number | undefined, opportunityScore: number | undefined, findings: SeoOpportunityFinding[]): number {
  if (typeof seoScore === "number" && seoScore <= 30) return 30;
  if (typeof seoScore === "number" && seoScore <= 50) return 24;
  if (typeof opportunityScore === "number" && opportunityScore >= 75) return 24;
  if (typeof opportunityScore === "number" && opportunityScore >= 60) return 18;
  if (findings.some((finding) => finding.severity === "high")) return 18;
  return 8;
}

function scoreContactability(methods: ContactMethod[]): number {
  if (methods.some((method) => method.type === "email" && method.confidence !== "low")) return 20;
  if (methods.some((method) => method.type === "form" || method.type === "contact_page")) return 16;
  if (methods.some((method) => method.type === "social_dm" || method.type === "phone" || method.type === "maps_profile")) return 10;
  return 0;
}

function confidenceScore(confidence: SourceConfidence): number {
  if (confidence === "high") return 15;
  if (confidence === "medium") return 10;
  return 5;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

