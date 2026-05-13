import "dotenv/config";
import Stripe from "stripe";
import sgMail from "@sendgrid/mail";
import { randomUUID } from "node:crypto";
import { crawlBatch } from "../site-crawler/crawler.js";
import { generateProposal } from "../proposal-generator/generator.js";
import { saveProposal } from "../proposal-generator/storage.js";
import type { Target } from "../types/index.js";
import { saveSmokeReport, summarizeSmokeStatus } from "./report.js";
import type { SmokeOptions, SmokeRunReport, SmokeStepResult } from "./types.js";

const DEFAULT_TARGET_URL = "https://example.com";

type StepBody = () => Promise<Omit<SmokeStepResult, "name" | "durationMs">>;

export async function runE2eSmoke(options: SmokeOptions = {}): Promise<SmokeRunReport> {
  const now = options.now ?? (() => new Date());
  const startedAtDate = now();
  const id = toRunId(startedAtDate);
  const targetUrl = options.targetUrl ?? process.env.SMOKE_TARGET_URL ?? DEFAULT_TARGET_URL;
  const steps: SmokeStepResult[] = [];
  const outputs: Record<string, unknown> = {};
  let target: Target | undefined;

  steps.push(
    await runStep("crawl_and_score", async () => {
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
      return {
        status: "passed",
        details: {
          domain: target.domain,
          seoScore: target.seoScore,
          diagnostics: target.diagnostics.length,
        },
      };
    })
  );

  steps.push(
    await runStep("generate_proposal", async () => {
      if (!target) return { status: "skipped", reason: "crawl_and_score did not produce a target" };
      if (!process.env.GEMINI_API_KEY) {
        return { status: "skipped", reason: "GEMINI_API_KEY is not set" };
      }
      const markdown = await generateProposal(target);
      const proposalPath = await saveProposal(target.domain, markdown);
      outputs.proposalPath = proposalPath;
      return { status: "passed", details: { proposalPath, bytes: markdown.length } };
    })
  );

  steps.push(await runStep("sendgrid_email", () => smokeSendGrid(target)));
  steps.push(await runStep("telegram_notification", () => smokeTelegram(target)));
  steps.push(await runStep("stripe_payment_link", () => smokeStripe(target, outputs)));

  const completedAtDate = now();
  const report: SmokeRunReport = {
    id,
    targetUrl,
    startedAt: startedAtDate.toISOString(),
    completedAt: completedAtDate.toISOString(),
    status: summarizeSmokeStatus(steps),
    steps,
    outputs,
  };
  report.reportPath = await saveSmokeReport(report, options.reportDir);
  return report;
}

async function runStep(name: string, body: StepBody): Promise<SmokeStepResult> {
  const started = Date.now();
  try {
    const result = await body();
    return { name, durationMs: Date.now() - started, ...result };
  } catch (err) {
    return {
      name,
      status: "failed",
      durationMs: Date.now() - started,
      error: sanitizeError(err),
    };
  }
}

async function smokeSendGrid(target: Target | undefined): Promise<Omit<SmokeStepResult, "name" | "durationMs">> {
  if (!target) return { status: "skipped", reason: "crawl_and_score did not produce a target" };
  if (process.env.SMOKE_SEND_EMAIL !== "true") {
    return { status: "skipped", reason: "SMOKE_SEND_EMAIL is not true" };
  }
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

async function smokeTelegram(target: Target | undefined): Promise<Omit<SmokeStepResult, "name" | "durationMs">> {
  if (!target) return { status: "skipped", reason: "crawl_and_score did not produce a target" };
  if (process.env.SMOKE_SEND_TELEGRAM !== "true") {
    return { status: "skipped", reason: "SMOKE_SEND_TELEGRAM is not true" };
  }
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

async function smokeStripe(
  target: Target | undefined,
  outputs: Record<string, unknown>
): Promise<Omit<SmokeStepResult, "name" | "durationMs">> {
  if (!target) return { status: "skipped", reason: "crawl_and_score did not produce a target" };
  if (process.env.SMOKE_CREATE_STRIPE_LINK !== "true") {
    return { status: "skipped", reason: "SMOKE_CREATE_STRIPE_LINK is not true" };
  }
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
  if (err instanceof Error) return err.message;
  return String(err);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targetUrl = process.argv[2];
  const report = await runE2eSmoke({ targetUrl });
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "failed") process.exitCode = 1;
}
