import Stripe from "stripe";
import sgMail from "@sendgrid/mail";
import { randomUUID } from "node:crypto";
import { crawlBatch } from "../site-crawler/crawler.js";
import { generateProposal } from "../proposal-generator/generator.js";
import { saveProposal } from "../proposal-generator/storage.js";
import type { Target } from "../types/index.js";
import { completeAgentRun, createAgentRun, upsertAgentRunStep } from "../agent-runs/repository.js";
import { persistSiteResult } from "../sites/repository.js";
import { logger } from "../utils/logger.js";
import { sanitizeSecretText } from "./security.js";
import type { RevenueAgentRunOptions, RevenueAgentRunReport, RevenueAgentStepResult } from "./types.js";

type StepBody = () => Promise<Omit<RevenueAgentStepResult, "name" | "durationMs">>;

export async function runRevenueAgent(options: RevenueAgentRunOptions): Promise<RevenueAgentRunReport> {
  const now = options.now ?? (() => new Date());
  const startedAtDate = now();
  const id = toRunId(startedAtDate);
  const targetUrl = options.targetUrl;
  const steps: RevenueAgentStepResult[] = [];
  const outputs: Record<string, unknown> = {};
  const artifacts: Array<{
    type: string;
    label: string;
    pathOrUrl?: string;
    contentText?: string;
    metadata?: Record<string, unknown>;
  }> = [];
  let target: Target | undefined;

  await recordRunStart({
    id,
    source: options.source ?? "api",
    targetUrl,
    sendEmail: options.sendEmail === true,
    sendTelegram: options.sendTelegram === true,
    createPaymentLink: options.createPaymentLink === true,
    metadata: options.metadata,
    startedAt: startedAtDate,
  });

  steps.push(
    await runStep(id, "crawl_and_score", async () => {
      if (!process.env.FIRECRAWL_API_KEY) {
        return { status: "skipped", reason: "FIRECRAWL_API_KEY is not set" };
      }
      const result = await crawlBatch([targetUrl], { threshold: 100 });
      target = result.targets[0];
      outputs.crawl = {
        targets: result.targets.length,
        skipped: result.skipped,
        queued: result.queued.length,
      };
      if (!target) {
        return {
          status: "failed",
          error: "No target produced by crawl and Lighthouse steps",
          details: outputs.crawl as Record<string, unknown>,
        };
      }
      outputs.seoScore = target.seoScore;
      outputs.opportunityScore = target.opportunityScore;
      outputs.opportunityFindings = target.opportunityFindings ?? [];
      outputs.domain = target.domain;
      return {
        status: "passed",
        details: {
          domain: target.domain,
          seoScore: target.seoScore,
          opportunityScore: target.opportunityScore,
          opportunityFindings: target.opportunityFindings?.length ?? 0,
          diagnostics: target.diagnostics.length,
        },
      };
    })
  );

  steps.push(
    await runStep(id, "generate_proposal", async () => {
      if (!target) return { status: "skipped", reason: "crawl_and_score did not produce a target" };
      if (!process.env.GEMINI_API_KEY) {
        return { status: "skipped", reason: "GEMINI_API_KEY is not set" };
      }
      const markdown = await generateProposal(target);
      const proposalPath = await saveProposal(target.domain, markdown);
      outputs.proposalPath = proposalPath;
      artifacts.push({
        type: "proposal",
        label: `${target.domain} proposal`,
        pathOrUrl: proposalPath,
        contentText: markdown,
        metadata: { domain: target.domain, bytes: markdown.length },
      });
      return { status: "passed", details: { proposalPath, bytes: markdown.length } };
    })
  );

  steps.push(
    await runStep(id, "sendgrid_email", () =>
      sendGridStep(target, options.sendEmail === true, options.sideEffectSkipReasons?.sendEmail)
    )
  );
  steps.push(
    await runStep(id, "telegram_notification", () =>
      telegramStep(target, options.sendTelegram === true, options.sideEffectSkipReasons?.sendTelegram)
    )
  );
  steps.push(
    await runStep(id, "stripe_payment_link", () =>
      stripeStep(target, options.createPaymentLink === true, outputs, options.sideEffectSkipReasons?.createPaymentLink)
    )
  );

  const completedAtDate = now();
  const report = {
    id,
    targetUrl,
    startedAt: startedAtDate.toISOString(),
    completedAt: completedAtDate.toISOString(),
    status: summarizeRunStatus(steps),
    steps,
    outputs,
  };
  await recordRunComplete(report, artifacts, completedAtDate);
  await recordSiteResult(report, target, artifacts, completedAtDate);
  return report;
}

export function summarizeRunStatus(steps: RevenueAgentRunReport["steps"]): RevenueAgentRunReport["status"] {
  if (steps.some((step) => step.status === "failed")) return "failed";
  if (steps.every((step) => step.status === "skipped")) return "skipped";
  return "passed";
}

async function runStep(runId: string, name: string, body: StepBody): Promise<RevenueAgentStepResult> {
  const started = Date.now();
  await recordStepProgress({
    runId,
    name,
    status: "running",
    durationMs: 0,
    details: { message: `${name} started` },
    createdAt: new Date(started),
  });
  try {
    const result = await body();
    const step = { name, durationMs: Date.now() - started, ...result };
    await recordStepProgress({
      runId,
      name,
      status: step.status,
      durationMs: step.durationMs,
      reason: step.reason,
      error: step.error,
      details: step.details,
      createdAt: new Date(started),
    });
    return step;
  } catch (err) {
    const step = {
      name,
      status: "failed",
      durationMs: Date.now() - started,
      error: sanitizeError(err),
    } as const;
    await recordStepProgress({
      runId,
      name,
      status: step.status,
      durationMs: step.durationMs,
      error: step.error,
      createdAt: new Date(started),
    });
    return step;
  }
}

async function sendGridStep(
  target: Target | undefined,
  enabled: boolean,
  disabledReason?: string
): Promise<Omit<RevenueAgentStepResult, "name" | "durationMs">> {
  if (!target) return { status: "skipped", reason: "crawl_and_score did not produce a target" };
  if (!enabled) return { status: "skipped", reason: disabledReason ?? "sendEmail is not true" };
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    return { status: "skipped", reason: "SENDGRID_API_KEY or SENDGRID_FROM_EMAIL is not set" };
  }
  const to = process.env.SMOKE_EMAIL_TO || process.env.SENDGRID_FROM_EMAIL;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send({
    to,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL,
      name: process.env.SENDGRID_FROM_NAME ?? "SEO Smoke Test",
    },
    subject: `[Smoke Test] SEO outreach pipeline for ${target.domain}`,
    text: `Smoke test email for ${target.url}. SEO score: ${target.seoScore}/100.`,
  });
  return { status: "passed", details: { to } };
}

async function telegramStep(
  target: Target | undefined,
  enabled: boolean,
  disabledReason?: string
): Promise<Omit<RevenueAgentStepResult, "name" | "durationMs">> {
  if (!target) return { status: "skipped", reason: "crawl_and_score did not produce a target" };
  if (!enabled) return { status: "skipped", reason: disabledReason ?? "sendTelegram is not true" };
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return { status: "skipped", reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set" };
  }
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: `[Smoke Test] ${target.domain} SEO score: ${target.seoScore}/100`,
      disable_web_page_preview: true,
    }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string; result?: { message_id?: number } };
  if (!json.ok) throw new Error(`Telegram API error: ${json.error ?? "unknown"}`);
  return {
    status: "passed",
    details: { chatId: process.env.TELEGRAM_CHAT_ID, messageId: json.result?.message_id },
  };
}

async function stripeStep(
  target: Target | undefined,
  enabled: boolean,
  outputs: Record<string, unknown>,
  disabledReason?: string
): Promise<Omit<RevenueAgentStepResult, "name" | "durationMs">> {
  if (!target) return { status: "skipped", reason: "crawl_and_score did not produce a target" };
  if (!enabled) return { status: "skipped", reason: disabledReason ?? "createPaymentLink is not true" };
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: "skipped", reason: "STRIPE_SECRET_KEY is not set" };
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const product = await stripe.products.create({
    name: `Smoke Test SEO Service - ${target.domain}`,
    metadata: { smokeRun: "true", targetId: target.id, domain: target.domain },
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Number(process.env.SMOKE_STRIPE_AMOUNT_JPY ?? 100),
    currency: "jpy",
  });
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { smokeRun: "true", targetId: target.id, domain: target.domain },
  });
  outputs.paymentLinkUrl = paymentLink.url;
  return { status: "passed", details: { paymentLinkId: paymentLink.id, url: paymentLink.url } };
}

function toRunId(date: Date): string {
  return `${date.toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
}

function sanitizeError(err: unknown): string {
  return sanitizeSecretText(err);
}

async function recordRunStart(input: {
  id: string;
  source: string;
  targetUrl: string;
  sendEmail: boolean;
  sendTelegram: boolean;
  createPaymentLink: boolean;
  metadata?: Record<string, unknown>;
  startedAt: Date;
}): Promise<void> {
  try {
    await createAgentRun({
      id: input.id,
      agentType: "revenue_agent",
      source: input.source,
      input: {
        targetUrl: input.targetUrl,
        sendEmail: input.sendEmail,
        sendTelegram: input.sendTelegram,
        createPaymentLink: input.createPaymentLink,
      },
      metadata: input.metadata,
      startedAt: input.startedAt,
    });
  } catch (error) {
    logger.error("Failed to persist agent run start", { error });
  }
}

async function recordStepProgress(input: {
  runId: string;
  name: string;
  status: RevenueAgentStepResult["status"] | "running";
  durationMs: number;
  reason?: string;
  error?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}): Promise<void> {
  try {
    await upsertAgentRunStep(input);
  } catch (error) {
    logger.error("Failed to persist agent run step progress", { error, runId: input.runId, step: input.name });
  }
}

async function recordRunComplete(
  report: RevenueAgentRunReport,
  artifacts: Array<{
    type: string;
    label: string;
    pathOrUrl?: string;
    contentText?: string;
    metadata?: Record<string, unknown>;
  }>,
  completedAt: Date
): Promise<void> {
  try {
    await completeAgentRun({
      id: report.id,
      status: report.status,
      completedAt,
      summary: {
        targetUrl: report.targetUrl,
        domain: report.outputs.domain,
        seoScore: report.outputs.seoScore,
        opportunityScore: report.outputs.opportunityScore,
        opportunityFindings: report.outputs.opportunityFindings,
        proposalPath: report.outputs.proposalPath,
        paymentLinkUrl: report.outputs.paymentLinkUrl,
      },
      error: report.steps.find((step) => step.status === "failed")?.error,
      steps: report.steps,
      artifacts,
    });
  } catch (error) {
    logger.error("Failed to persist agent run completion", { error });
  }
}

async function recordSiteResult(
  report: RevenueAgentRunReport,
  target: Target | undefined,
  artifacts: Array<{
    type: string;
    label: string;
    pathOrUrl?: string;
    contentText?: string;
    metadata?: Record<string, unknown>;
  }>,
  completedAt: Date
): Promise<void> {
  if (!target) return;

  try {
    await persistSiteResult({
      runId: report.id,
      status: report.status,
      target,
      summary: {
        targetUrl: report.targetUrl,
        domain: report.outputs.domain,
        seoScore: report.outputs.seoScore,
        opportunityScore: report.outputs.opportunityScore,
        opportunityFindings: report.outputs.opportunityFindings,
        proposalPath: report.outputs.proposalPath,
        paymentLinkUrl: report.outputs.paymentLinkUrl,
      },
      proposals: artifacts
        .filter((artifact) => artifact.type === "proposal")
        .map((artifact) => ({
          label: artifact.label,
          pathOrUrl: artifact.pathOrUrl,
          contentText: artifact.contentText,
          metadata: artifact.metadata,
        })),
      createdAt: completedAt,
    });
  } catch (error) {
    logger.error("Failed to persist site result", { error });
  }
}
