import type { ContactMethod } from "../types/index.js";

export type SalesOutreachStatus = "draft" | "sent" | "skipped" | "failed";
export type SalesPaymentLinkStatus = "created" | "sent" | "failed" | "paid";

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
  approval: SalesOutreachApprovalRecommendation;
}

export interface SalesOutreachApprovalRecommendation {
  priority: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  recommendedAmountJpy: number;
  rationale: string[];
  caveats: string[];
  recipientSource: "detected_email" | "manual_required";
  readyToSend: boolean;
  nextStep: string;
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

export interface SalesActions {
  outreachMessages: SalesOutreachMessage[];
  paymentLinks: SalesPaymentLinkRecord[];
}

export interface CreateOutreachMessageInput {
  runId: string;
  siteId?: string;
  snapshotId?: string;
  targetUrl: string;
  domain: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: SalesOutreachStatus;
  reviewedAt?: Date;
  sentAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentLinkInput {
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
  expiresAt?: Date;
  sentAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}
