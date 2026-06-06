import type { ContactMethod, SeoDiagnostic, SeoOpportunityFinding } from "../types/index.js";

export type LeadSourceId =
  | "seed"
  | "firecrawl_search"
  | "google_search"
  | "google_maps"
  | "apollo_organization"
  | "technology_intelligence";

export type LeadSourceStatus = "passed" | "skipped" | "failed";
export type SourceConfidence = "low" | "medium" | "high";

export interface LeadSourceInput {
  queries: string[];
  seedUrls: string[];
  limit: number;
  country: string;
  lang: string;
  location: string;
  env: NodeJS.ProcessEnv;
}

export interface LeadDiscoveryContext {
  now: Date;
}

export interface LeadSourceRunReport {
  source: LeadSourceId;
  status: LeadSourceStatus;
  candidateCount: number;
  reason?: string;
}

export interface RawLeadCandidate {
  source: LeadSourceId;
  url?: string;
  domain?: string;
  query?: string;
  title?: string;
  snippet?: string;
  businessName?: string;
  category?: string;
  location?: string;
  sourceBusinessId?: string;
  technologies?: string[];
  contactHints?: LeadContactHint[];
  confidence?: SourceConfidence;
  metadata?: Record<string, unknown>;
}

export interface LeadContactHint {
  type: ContactMethod["type"];
  value: string;
  sourceUrl?: string;
  confidence?: ContactMethod["confidence"];
  label?: string;
  reason?: string;
}

export interface SourceProvenance {
  source: LeadSourceId;
  sourceBusinessId?: string;
  query?: string;
  title?: string;
  snippet?: string;
  confidence: SourceConfidence;
  metadata: Record<string, unknown>;
}

export type LeadStage =
  | "candidate_collected"
  | "candidate_normalized"
  | "candidate_deduped"
  | "business_site_qualified"
  | "business_site_rejected"
  | "seo_issue_qualified"
  | "seo_issue_rejected"
  | "contact_methods_discovered"
  | "priority_scored"
  | "routed";

export type LeadStageStatus = "passed" | "skipped" | "failed" | "held";

export interface LeadStageEvent {
  stage: LeadStage;
  status: LeadStageStatus;
  reasonCode?: string;
  message?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SiteCandidate {
  id?: string;
  url: string;
  normalizedUrl: string;
  domain: string;
  businessName?: string;
  category?: string;
  location?: string;
  technologies: string[];
  contactHints: LeadContactHint[];
  sourceProvenance: SourceProvenance[];
  sourceConfidence: SourceConfidence;
  stageEvents: LeadStageEvent[];
  metadata: Record<string, unknown>;
}

export interface BusinessSiteQualification {
  status: "passed" | "rejected" | "held";
  reasonCode: string;
  message: string;
  confidence: SourceConfidence;
}

export interface SeoIssueQualification {
  status: "passed" | "rejected" | "held";
  reasonCode: string;
  message: string;
  seoScore?: number;
  opportunityScore?: number;
  diagnostics: SeoDiagnostic[];
  opportunityFindings: SeoOpportunityFinding[];
}

export type LeadPriorityLabel = "low" | "medium" | "high";

export interface LeadPriorityScore {
  total: number;
  label: LeadPriorityLabel;
  components: {
    seoSeverity: number;
    businessFit: number;
    sourceConfidence: number;
    sourceConfirmation: number;
    contactability: number;
    operationalFit: number;
  };
  reasons: string[];
}

export type DeliveryRoute =
  | "send_email"
  | "queue_contact_form"
  | "queue_social_dm"
  | "queue_manual_follow_up"
  | "skip_duplicate"
  | "hold_policy_blocked";

export interface LeadRouteDecision {
  route: DeliveryRoute;
  status: "ready" | "queued" | "skipped" | "held";
  reasonCode: string;
  message: string;
  contactMethod?: ContactMethod;
  priorityScore?: LeadPriorityScore;
}

export interface LeadSourceAdapter {
  id: LeadSourceId;
  discover(input: LeadSourceInput, context: LeadDiscoveryContext): Promise<RawLeadCandidate[]>;
}

export interface LeadSourceExecutionResult {
  report: LeadSourceRunReport;
  candidates: RawLeadCandidate[];
}
