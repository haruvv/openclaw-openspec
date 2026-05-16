import Stripe from "stripe";
import sgMail from "@sendgrid/mail";
import { getAgentRunDetail } from "../agent-runs/repository.js";
import { getSideEffectSettings } from "../admin/side-effect-settings.js";
import { sideEffectPolicyReason } from "../revenue-agent/security.js";
import { withRetry } from "../utils/retry.js";
import { sanitizeSecretText } from "../revenue-agent/security.js";
import { logger } from "../utils/logger.js";
import { getSalesOperationSettings } from "./settings.js";
import {
  createOutreachMessage,
  createPaymentLinkRecord,
  getSalesActionsForRun,
  getSiteContextForRun,
  hasRecentSentOutreach,
  markPaymentLinkFailed,
  markPaymentLinkSent,
} from "./repository.js";
import type { SalesActions, SalesOutreachDraft, SalesOutreachMessage, SalesPaymentLinkRecord } from "./types.js";
import type { ContactMethod, LlmRevenueAudit } from "../types/index.js";

const PAYMENT_LINK_VALIDITY_DAYS = 30;
const DAY_MS = 86400 * 1000;

export async function buildOutreachDraft(runId: string): Promise<SalesOutreachDraft | null> {
  const run = await getAgentRunDetail(runId);
  if (!run) return null;
  const targetUrl = readString(run.summary.targetUrl) ?? readString(run.input.targetUrl) ?? readString(run.input.url);
  const domain = readString(run.summary.domain) ?? (targetUrl ? new URL(targetUrl).hostname : undefined);
  if (!targetUrl || !domain) return null;

  const context = await getSiteContextForRun(runId);
  const audit = readAudit(run.summary.llmRevenueAudit);
  const contactMethods = readContactMethods(run.summary.contactMethods);
  const recipientEmail = readString(run.summary.contactEmail) ?? contactMethods.find((method) => method.type === "email")?.value;
  if (audit) {
    return {
      runId,
      siteId: context.siteId,
      snapshotId: context.snapshotId,
      targetUrl,
      domain,
      recipientEmail,
      contactMethods,
      subject: audit.outreach.subject,
      bodyText: audit.outreach.firstEmail,
      source: "llm_revenue_audit",
      caveats: audit.caveats,
    };
  }

  return {
    runId,
    siteId: context.siteId,
    snapshotId: context.snapshotId,
    targetUrl,
    domain,
    recipientEmail,
    contactMethods,
    subject: `ホームページの簡易診断について`,
    bodyText: `${domain} ご担当者様

突然のご連絡失礼いたします。
公開されているホームページを確認した範囲で、検索結果での見え方や問い合わせ導線について、いくつか簡単に共有できそうな点がありました。

もしご迷惑でなければ、無料の簡易診断として要点だけお送りします。
ご希望でしたら、このメールにご返信ください。`,
    source: "fallback",
    caveats: ["LLM営業評価がないため、保守的な汎用文面を生成しています。"],
  };
}

export async function getRunSalesState(runId: string): Promise<SalesActions> {
  return getSalesActionsForRun(runId);
}

export async function sendReviewedOutreach(input: {
  runId: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
}): Promise<SalesOutreachMessage> {
  const draft = await buildOutreachDraft(input.runId);
  if (!draft) throw new Error("outreach draft is not available for this run");
  const recipientEmail = input.recipientEmail.trim();
  const subject = input.subject.trim();
  const bodyText = input.bodyText.trim();
  if (!isEmail(recipientEmail)) throw new Error("recipientEmail must be a valid email address");
  if (!subject) throw new Error("subject is required");
  if (!bodyText) throw new Error("bodyText is required");

  const salesSettings = await getSalesOperationSettings();
  const policies = await getSideEffectSettings();
  if (!policies.sendEmail) {
    await recordSkippedOutreach(draft, recipientEmail, subject, bodyText, sideEffectPolicyReason("sendEmail"));
    throw new Error(sideEffectPolicyReason("sendEmail"));
  }
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    await recordSkippedOutreach(draft, recipientEmail, subject, bodyText, "SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is not set");
    throw new Error("SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is not set");
  }
  if (await hasRecentSentOutreach(draft.domain, salesSettings.outreachCooldownDays)) {
    await recordSkippedOutreach(draft, recipientEmail, subject, bodyText, "outreach already sent to this domain within cooldown window");
    throw new Error("outreach already sent to this domain within cooldown window");
  }

  const now = new Date();
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await withRetry(() =>
      sgMail.send({
        to: recipientEmail,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL!,
          name: salesSettings.sendgridFromName,
        },
        subject,
        text: bodyText,
        html: escapeHtml(bodyText).replace(/\n/g, "<br>"),
      }),
    );
    return createOutreachMessage({
      runId: draft.runId,
      siteId: draft.siteId,
      snapshotId: draft.snapshotId,
      targetUrl: draft.targetUrl,
      domain: draft.domain,
      recipientEmail,
      subject,
      bodyText,
      status: "sent",
      reviewedAt: now,
      sentAt: now,
      metadata: { source: draft.source, humanApproved: true },
    });
  } catch (err) {
    const error = sanitizeSecretText(err);
    await createOutreachMessage({
      runId: draft.runId,
      siteId: draft.siteId,
      snapshotId: draft.snapshotId,
      targetUrl: draft.targetUrl,
      domain: draft.domain,
      recipientEmail,
      subject,
      bodyText,
      status: "failed",
      reviewedAt: now,
      error,
      metadata: { source: draft.source, humanApproved: true },
    });
    throw new Error(error);
  }
}

export async function createReviewedPaymentLink(input: {
  runId: string;
  outreachMessageId?: string;
  recipientEmail?: string;
  amountJpy: number;
  sendEmail?: boolean;
}): Promise<SalesPaymentLinkRecord> {
  const draft = await buildOutreachDraft(input.runId);
  if (!draft) throw new Error("outreach draft is not available for this run");
  if (!Number.isInteger(input.amountJpy) || input.amountJpy <= 0) {
    throw new Error("amountJpy must be a positive integer");
  }

  const policies = await getSideEffectSettings();
  const salesSettings = await getSalesOperationSettings();
  if (!policies.createPaymentLink) throw new Error(sideEffectPolicyReason("createPaymentLink"));
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  if (input.sendEmail === true && !policies.sendEmail) throw new Error(sideEffectPolicyReason("sendEmail"));
  if (input.sendEmail === true && (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL)) {
    throw new Error("SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is not set");
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const expiresAt = new Date(Date.now() + PAYMENT_LINK_VALIDITY_DAYS * DAY_MS);
  let record: SalesPaymentLinkRecord | undefined;
  let stripeProductId: string | undefined;
  let stripePriceId: string | undefined;
  let stripePaymentLinkId: string | undefined;
  let paymentLinkUrl: string | undefined;
  try {
    const product = await stripe.products.create({
      name: `SEO改善サービス - ${draft.domain}`,
      metadata: { runId: draft.runId, domain: draft.domain },
    });
    stripeProductId = product.id;
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: input.amountJpy,
      currency: "jpy",
    });
    stripePriceId = price.id;
    const paymentLink = await withRetry(() =>
      stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: {
          runId: draft.runId,
          domain: draft.domain,
        },
        after_completion: {
          type: "redirect",
          redirect: { url: (process.env.HIL_APPROVAL_BASE_URL ?? "https://revenue-agent-platform.haruki-ito0044.workers.dev") + "/thank-you" },
        },
      }),
    );
    stripePaymentLinkId = paymentLink.id;
    paymentLinkUrl = paymentLink.url;
    record = await createPaymentLinkRecord({
      runId: draft.runId,
      siteId: draft.siteId,
      outreachMessageId: input.outreachMessageId,
      domain: draft.domain,
      recipientEmail: input.recipientEmail,
      amountJpy: input.amountJpy,
      stripeProductId: product.id,
      stripePriceId: price.id,
      stripePaymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
      status: "created",
      expiresAt,
      metadata: { humanApproved: true },
    });

    if (input.sendEmail === true && input.recipientEmail) {
      await sendPaymentLinkEmail(input.recipientEmail, draft.domain, paymentLink.url, expiresAt, salesSettings.sendgridFromName);
      if (policies.sendTelegram) {
        await notifyTelegramPaymentLink(draft.domain, paymentLink.url).catch((err) => {
          logger.error("Telegram payment link notify failed", { err: sanitizeSecretText(err) });
        });
      }
      return markPaymentLinkSent(record.id, new Date());
    }
    return record;
  } catch (err) {
    const error = sanitizeSecretText(err);
    if (record) {
      await markPaymentLinkFailed(record.id, error);
    } else {
      await createPaymentLinkRecord({
        runId: draft.runId,
        siteId: draft.siteId,
        outreachMessageId: input.outreachMessageId,
        domain: draft.domain,
        recipientEmail: input.recipientEmail,
        amountJpy: input.amountJpy,
        stripeProductId,
        stripePriceId,
        stripePaymentLinkId,
        paymentLinkUrl,
        status: "failed",
        error,
        metadata: { humanApproved: true },
      });
    }
    throw new Error(error);
  }
}

async function recordSkippedOutreach(
  draft: SalesOutreachDraft,
  recipientEmail: string,
  subject: string,
  bodyText: string,
  reason: string,
): Promise<void> {
  await createOutreachMessage({
    runId: draft.runId,
    siteId: draft.siteId,
    snapshotId: draft.snapshotId,
    targetUrl: draft.targetUrl,
    domain: draft.domain,
    recipientEmail,
    subject,
    bodyText,
    status: "skipped",
    reviewedAt: new Date(),
    error: reason,
    metadata: { source: draft.source, humanApproved: true },
  });
}

async function sendPaymentLinkEmail(
  recipientEmail: string,
  domain: string,
  linkUrl: string,
  expiresAt: Date,
  fromName: string,
): Promise<void> {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  const expiryDate = expiresAt.toLocaleDateString("ja-JP");
  await withRetry(() =>
    sgMail.send({
      to: recipientEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL!,
        name: fromName,
      },
      subject: `【お申し込み】${domain} SEO改善サービスのお支払いページ`,
      text: `この度はご関心をいただきありがとうございます。\n\n下記リンクよりお申し込みください（有効期限: ${expiryDate}）：\n${linkUrl}`,
    }),
  );
}

async function notifyTelegramPaymentLink(domain: string, linkUrl: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: `Payment Link送付完了: \`${domain}\`\n${linkUrl}`,
      disable_web_page_preview: true,
    }),
  });
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readAudit(value: unknown): LlmRevenueAudit | null {
  if (!value || typeof value !== "object") return null;
  const audit = value as LlmRevenueAudit;
  return typeof audit.outreach?.subject === "string" && typeof audit.outreach?.firstEmail === "string" ? audit : null;
}

function readContactMethods(value: unknown): ContactMethod[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isContactMethod).slice(0, 10);
}

function isContactMethod(value: unknown): value is ContactMethod {
  if (!value || typeof value !== "object") return false;
  const method = value as ContactMethod;
  return ["email", "form", "phone", "contact_page"].includes(method.type)
    && typeof method.value === "string"
    && method.value.length > 0
    && typeof method.sourceUrl === "string"
    && ["low", "medium", "high"].includes(method.confidence);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
