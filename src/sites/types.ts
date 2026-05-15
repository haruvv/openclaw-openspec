import type { AgentRunStatus } from "../agent-runs/types.js";
import type { SalesOutreachStatus, SalesPaymentLinkStatus } from "../sales/types.js";
import type { SeoDiagnostic, SeoOpportunityFinding } from "../types/index.js";

export interface SiteRecord {
  id: string;
  normalizedUrl: string;
  displayUrl: string;
  domain: string;
  latestStatus: AgentRunStatus;
  latestSeoScore?: number;
  latestOpportunityScore?: number;
  latestRunId?: string;
  latestSnapshotId?: string;
  latestOutreachStatus?: SalesOutreachStatus;
  latestOutreachSentAt?: string;
  latestPaymentLinkStatus?: SalesPaymentLinkStatus;
  latestPaymentLinkAmountJpy?: number;
  latestPaymentLinkUrl?: string;
  snapshotCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSnapshotRecord {
  id: string;
  siteId: string;
  runId?: string;
  targetUrl: string;
  domain: string;
  status: AgentRunStatus;
  seoScore?: number;
  opportunityScore?: number;
  opportunityFindings: SeoOpportunityFinding[];
  diagnostics: SeoDiagnostic[];
  summary: Record<string, unknown>;
  createdAt: string;
}

export interface SiteProposalRecord {
  id: string;
  siteId: string;
  snapshotId: string;
  runId?: string;
  label: string;
  pathOrUrl?: string;
  contentText?: string;
  bodyStorage: "inline" | "object";
  objectKey?: string;
  contentType?: string;
  byteSize?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SiteDetail extends SiteRecord {
  snapshots: SiteSnapshotRecord[];
  proposals: SiteProposalRecord[];
}
