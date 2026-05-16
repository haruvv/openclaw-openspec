export type Status = "running" | "passed" | "failed" | "skipped";
export type SalesOutreachStatus = "draft" | "sent" | "skipped" | "failed";
export type SalesPaymentLinkStatus = "created" | "sent" | "failed" | "paid";
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

export interface BusinessApp {
  id: string;
  name: string;
  description: string;
  status: "active" | "planned";
  entryPath: string;
  primaryLinks: Array<{ label: string; href: string }>;
}

export interface AgentRun {
  id: string;
  agentType: string;
  source: string;
  status: Status;
  input: Record<string, unknown>;
  summary: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface AgentRunDetail extends AgentRun {
  steps: Array<{ id: string; name: string; status: Status; durationMs: number; reason?: string; error?: string; details?: Record<string, unknown> }>;
  artifacts: Array<ArtifactRecord>;
  salesActions?: SalesActions;
}

export interface SiteRecord {
  id: string;
  displayUrl: string;
  normalizedUrl: string;
  domain: string;
  latestStatus: Status;
  latestSeoScore?: number;
  latestOpportunityScore?: number;
  latestRunId?: string;
  latestOutreachStatus?: SalesOutreachStatus;
  latestOutreachSentAt?: string;
  latestPaymentLinkStatus?: SalesPaymentLinkStatus;
  latestPaymentLinkAmountJpy?: number;
  latestPaymentLinkUrl?: string;
  snapshotCount: number;
  updatedAt: string;
}

export interface SiteDetail extends SiteRecord {
  snapshots: Array<{ id: string; status: Status; seoScore?: number; opportunityScore?: number; opportunityFindings: OpportunityFinding[]; diagnostics: unknown[]; createdAt: string; runId?: string; summary: Record<string, unknown> }>;
  proposals: Array<ProposalRecord>;
}

export interface OpportunityFinding {
  category: string;
  severity: "low" | "medium" | "high";
  title: string;
  evidence: string;
  recommendation: string;
  scoreImpact: number;
}

export interface SeoDiagnostic {
  id: string;
  title: string;
  score: number | null;
  description: string;
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

export interface SalesActions {
  outreachMessages: SalesOutreachMessage[];
  paymentLinks: SalesPaymentLinkRecord[];
}

export interface SalesOutreachDraft {
  runId: string;
  siteId?: string;
  snapshotId?: string;
  targetUrl: string;
  domain: string;
  recipientEmail?: string;
  contactMethods: ContactMethod[];
  subject: string;
  bodyText: string;
  source: "llm_revenue_audit" | "fallback";
  caveats: string[];
}

export interface SalesOutreachMessage {
  id: string;
  runId: string;
  siteId?: string;
  snapshotId?: string;
  targetUrl: string;
  domain: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: SalesOutreachStatus;
  reviewedAt?: string;
  sentAt?: string;
  error?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SalesPaymentLinkRecord {
  id: string;
  runId: string;
  siteId?: string;
  outreachMessageId?: string;
  domain: string;
  recipientEmail?: string;
  amountJpy: number;
  stripeProductId?: string;
  stripePriceId?: string;
  stripePaymentLinkId?: string;
  paymentLinkUrl?: string;
  status: SalesPaymentLinkStatus;
  expiresAt?: string;
  sentAt?: string;
  error?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRecord {
  id: string;
  type: string;
  label: string;
  pathOrUrl?: string;
  contentText?: string;
  bodyStorage?: "inline" | "object";
  objectKey?: string;
  contentType?: string;
  byteSize?: number;
  createdAt?: string;
}

export interface ProposalRecord {
  id: string;
  label: string;
  pathOrUrl?: string;
  contentText?: string;
  bodyStorage?: "inline" | "object";
  objectKey?: string;
  contentType?: string;
  byteSize?: number;
  createdAt: string;
  runId?: string;
}

export interface SettingsPayload {
  integrations: Array<{ label: string; key: string; configured: boolean }>;
  policies: Array<{ key: "sendEmail" | "sendTelegram" | "createPaymentLink"; label: string; enabled: boolean }>;
  discovery: DiscoverySettings;
}

export type SideEffectPolicy = SettingsPayload["policies"][number];

export interface PolicyUpdatePayload {
  sendEmail: boolean;
  sendTelegram: boolean;
  createPaymentLink: boolean;
}

export interface DiscoverySettings {
  queries: string[];
  seedUrls: string[];
  dailyQuota: number;
  searchLimit: number;
  country: string;
  lang: string;
  location: string;
  configuredFromAdmin: boolean;
}

export interface DiscoveryReport {
  status: "disabled" | "skipped" | "passed" | "failed";
  enabled: boolean;
  quota: number;
  candidateCount: number;
  selectedCount: number;
  skipped: Array<{ url: string; reason: string }>;
  runs: Array<{ url: string; runId: string; status: Status }>;
}

export interface DiscoveryFormState {
  selectedIndustries: string[];
  customQueries: string;
  seedUrls: string;
  dailyQuota: string;
  searchLimit: string;
  country: string;
  lang: string;
  location: string;
  configuredFromAdmin: boolean;
}
