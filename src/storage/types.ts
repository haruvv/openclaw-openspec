import type { CreateAgentRunInput, CompleteAgentRunInput } from "../agent-runs/repository.js";
import type { AgentRunDetail, AgentRunRecord } from "../agent-runs/types.js";
import type { PersistSiteResultInput } from "../sites/repository.js";
import type { SiteDetail, SiteRecord } from "../sites/types.js";
import type { Target } from "../types/index.js";

export interface OperationalStorage {
  agentRuns: AgentRunStorage;
  sites: SiteStorage;
  targets: TargetStorage;
  outreach: OutreachStorage;
  hil: HilStorage;
  payments: PaymentStorage;
  artifacts: ArtifactBodyStorage;
}

export interface AgentRunStorage {
  create(input: CreateAgentRunInput): Promise<void>;
  complete(input: CompleteAgentRunInput): Promise<void>;
  list(limit?: number): Promise<AgentRunRecord[]>;
  getDetail(id: string): Promise<AgentRunDetail | null>;
}

export interface SiteStorage {
  persistResult(input: PersistSiteResultInput): Promise<SiteDetail>;
  list(limit?: number): Promise<SiteRecord[]>;
  getDetail(id: string): Promise<SiteDetail | null>;
}

export interface TargetStorage {
  save(target: Target): Promise<void>;
  get(id: string): Promise<Target | null>;
  listByStatus(status: Target["status"]): Promise<Target[]>;
}

export interface OutreachStorage {
  hasRecentSend(domain: string, since: Date): Promise<boolean>;
  countSince(since: Date): Promise<number>;
  recordSend(domain: string, sentAt: Date): Promise<void>;
}

export interface HilStorage {
  markApproved(targetId: string, updatedAt: Date): Promise<void>;
  markRejected(targetId: string, updatedAt: Date): Promise<void>;
  listTimedOutPending(cutoff: Date): Promise<HilPendingTarget[]>;
  markOnHold(targetId: string, updatedAt: Date): Promise<void>;
}

export interface PaymentStorage {
  updatePaymentLink(input: UpdatePaymentLinkInput): Promise<void>;
  listExpiringPaymentLinks(cutoff: Date, now: Date): Promise<PaymentReminderTarget[]>;
  markPaymentReminderSent(targetId: string, sentAt: Date): Promise<void>;
  markPaid(targetId: string, updatedAt: Date): Promise<void>;
}

export interface ArtifactBodyStorage {
  put(input: PutArtifactBodyInput): Promise<StoredArtifactBody>;
  get(reference: StoredArtifactBody): Promise<string | null>;
}

export interface HilPendingTarget {
  id: string;
  domain: string;
  seoScore: number;
  hilToken: string;
  updatedAt: Date;
}

export interface UpdatePaymentLinkInput {
  targetId: string;
  url: string;
  id: string;
  expiresAt: Date;
  updatedAt: Date;
}

export interface PaymentReminderTarget {
  id: string;
  domain: string;
  contactEmail?: string;
  paymentLinkUrl?: string;
  paymentLinkExpiresAt?: Date;
}

export interface PutArtifactBodyInput {
  runId?: string;
  siteId?: string;
  type: string;
  label: string;
  contentText: string;
  contentType: string;
  createdAt: Date;
}

export type StoredArtifactBody =
  | {
      storage: "inline";
      contentText: string;
      byteSize: number;
      contentType: string;
    }
  | {
      storage: "object";
      objectKey: string;
      byteSize: number;
      contentType: string;
    };
