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

export interface Target {
  id: string;
  url: string;
  domain: string;
  contactEmail?: string;
  industry?: string;
  seoScore: number;
  diagnostics: SeoDiagnostic[];
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
