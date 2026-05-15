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

export interface SeoOpportunityResult {
  opportunityScore: number;
  findings: SeoOpportunityFinding[];
}

export interface Target {
  id: string;
  url: string;
  domain: string;
  contactEmail?: string;
  industry?: string;
  seoScore: number;
  diagnostics: SeoDiagnostic[];
  opportunityScore?: number;
  opportunityFindings?: SeoOpportunityFinding[];
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
