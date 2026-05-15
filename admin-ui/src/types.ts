export type Status = "running" | "passed" | "failed" | "skipped";

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
