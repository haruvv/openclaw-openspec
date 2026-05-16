export type TargetStatus =
  | "pending"
  | "crawled"
  | "proposal_generated"
  | "outreach_queued"
  | "outreach_sent"
  | "hil_pending"
  | "approved"
  | "rejected"
  | "payment_link_sent"
  | "paid"
  | "skipped"
  | "error"
  | "on_hold";

export interface CrawlResult {
  url: string;
  domain: string;
  html: string;
  title: string;
  contactEmail?: string;
  contactMethods?: ContactMethod[];
  industry?: string;
}

export interface LighthouseResult {
  url: string;
  seoScore: number;
  diagnostics: SeoDiagnostic[];
}

export interface SeoDiagnostic {
  id: string;
  title: string;
  score: number | null;
  description: string;
}

export type SeoOpportunityCategory = "technical" | "content" | "intent" | "conversion" | "trust";
export type SeoOpportunitySeverity = "low" | "medium" | "high";

export interface SeoOpportunityFinding {
  category: SeoOpportunityCategory;
  severity: SeoOpportunitySeverity;
  title: string;
  evidence: string;
  recommendation: string;
  scoreImpact: number;
}

export type RevenueAuditPriority = "low" | "medium" | "high";
export type RevenueAuditConfidence = "low" | "medium" | "high";

export interface LlmRevenueAudit {
  overallAssessment: string;
  salesPriority: RevenueAuditPriority;
  confidence: RevenueAuditConfidence;
  businessImpactSummary: string;
  recommendedOffer: {
    name: string;
    description: string;
    estimatedPriceRange: string;
    reason: string;
  };
  prioritizedFindings: Array<{
    title: string;
    businessImpact: string;
    suggestedFix: string;
    salesAngle: string;
    confidence: RevenueAuditConfidence;
  }>;
  outreach: {
    subject: string;
    firstEmail: string;
    followUpEmail: string;
  };
  caveats: string[];
}

export type ContactMethodType = "email" | "form" | "phone" | "contact_page";
export type ContactMethodConfidence = "low" | "medium" | "high";

export interface ContactMethod {
  type: ContactMethodType;
  value: string;
  sourceUrl: string;
  confidence: ContactMethodConfidence;
  label?: string;
  reason?: string;
}

export interface SeoOpportunityResult {
  opportunityScore: number;
  findings: SeoOpportunityFinding[];
}

export interface Target {
  id: string;
  url: string;
  domain: string;
  contactEmail?: string;
  contactMethods?: ContactMethod[];
  industry?: string;
  seoScore: number;
  diagnostics: SeoDiagnostic[];
  opportunityScore?: number;
  opportunityFindings?: SeoOpportunityFinding[];
  llmRevenueAudit?: LlmRevenueAudit;
  status: TargetStatus;
  proposalPath?: string;
  hilToken?: string;
  paymentLinkUrl?: string;
  paymentLinkId?: string;
  paymentLinkExpiresAt?: number;
  paymentReminderSentAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface OutreachRecord {
  domain: string;
  sentAt: number;
}

export interface HilNotification {
  targetId: string;
  domain: string;
  seoScore: number;
  approveUrl: string;
  rejectUrl: string;
  sentAt: number;
}
