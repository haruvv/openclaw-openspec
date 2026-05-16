import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const { target } = vi.hoisted(() => ({
  target: {
    id: "t1",
    url: "https://example.com",
    domain: "example.com",
    contactEmail: "info@example.com",
    seoScore: 42,
    diagnostics: [],
    status: "crawled",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}));

vi.mock("../src/site-crawler/crawler.js", () => ({
  crawlBatch: vi.fn().mockResolvedValue({ targets: [target], skipped: [], skipDetails: [], queued: [] }),
}));

vi.mock("../src/proposal-generator/generator.js", () => ({
  generateProposal: vi.fn().mockResolvedValue("## 現状スコア\n\n## 課題一覧\n\n## 改善提案"),
}));

vi.mock("../src/proposal-generator/storage.js", () => ({
  saveProposal: vi.fn().mockResolvedValue("./output/proposals/example.com.md"),
}));

vi.mock("../src/revenue-audit/assessor.js", () => ({
  assessRevenueAudit: vi.fn().mockResolvedValue({
    overallAssessment: "問い合わせ導線に改善余地があります。",
    salesPriority: "medium",
    confidence: "high",
    businessImpactSummary: "相談前に離脱している可能性があります。",
    recommendedOffer: {
      name: "CTA改善",
      description: "問い合わせ導線を整えます。",
      estimatedPriceRange: "3万〜5万円",
      reason: "小さく始めやすいためです。",
    },
    prioritizedFindings: [],
    outreach: {
      subject: "簡易診断のご共有について",
      firstEmail: "もし必要であれば要点だけ共有します。",
      followUpEmail: "先日の件で必要でしたらお送りします。",
    },
    caveats: [],
  }),
}));

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{ statusCode: 202 }, {}]) },
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    products: { create: vi.fn().mockResolvedValue({ id: "prod_test" }) },
    prices: { create: vi.fn().mockResolvedValue({ id: "price_test" }) },
    paymentLinks: {
      create: vi.fn().mockResolvedValue({ id: "plink_test", url: "https://buy.stripe.com/test" }),
    },
  })),
}));

import sgMail from "@sendgrid/mail";
import { runE2eSmoke } from "../src/smoke/e2e-smoke.js";
import { crawlBatch } from "../src/site-crawler/crawler.js";

const originalEnv = { ...process.env };

describe("runE2eSmoke", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.FIRECRAWL_API_KEY = "firecrawl-test";
    process.env.GEMINI_API_KEY = "gemini-test";
    delete process.env.SMOKE_SEND_EMAIL;
    delete process.env.SMOKE_SEND_TELEGRAM;
    delete process.env.SMOKE_CREATE_STRIPE_LINK;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("skips side-effecting steps by default and persists a report", async () => {
    const reportDir = await mkdtemp(join(tmpdir(), "smoke-report-"));

    const report = await runE2eSmoke({
      targetUrl: "https://example.com",
      reportDir,
      now: () => new Date("2026-05-13T00:00:00.000Z"),
    });

    expect(report.status).toBe("passed");
    expect(report.reportPath).toBeTruthy();
    expect(report.steps.find((step) => step.name === "sendgrid_email")?.status).toBe("skipped");
    expect(report.steps.find((step) => step.name === "telegram_notification")?.status).toBe("skipped");
    expect(report.steps.find((step) => step.name === "stripe_payment_link")?.status).toBe("skipped");
    expect(sgMail.send).not.toHaveBeenCalled();

    const saved = JSON.parse(await readFile(report.reportPath!, "utf-8")) as typeof report;
    expect(saved.targetUrl).toBe("https://example.com");
    expect(saved.steps).toHaveLength(6);
    expect(saved.steps.find((step) => step.name === "llm_revenue_audit")?.status).toBe("passed");
    expect(saved.outputs.llmRevenueAudit).toMatchObject({ salesPriority: "medium", confidence: "high" });
  });

  it("marks missing credentials as skipped before provider calls", async () => {
    delete process.env.FIRECRAWL_API_KEY;
    const reportDir = await mkdtemp(join(tmpdir(), "smoke-report-"));

    const report = await runE2eSmoke({ reportDir });

    expect(report.status).toBe("skipped");
    expect(report.steps[0]).toMatchObject({
      name: "crawl_and_score",
      status: "skipped",
      reason: "FIRECRAWL_API_KEY is not set",
    });
    expect(crawlBatch).not.toHaveBeenCalled();
  });

  it("passes enabled side-effect flags through the shared run path", async () => {
    process.env.SMOKE_SEND_EMAIL = "true";
    process.env.SMOKE_SEND_TELEGRAM = "true";
    process.env.SMOKE_CREATE_STRIPE_LINK = "true";
    process.env.SENDGRID_API_KEY = "sendgrid-test";
    process.env.SENDGRID_FROM_EMAIL = "from@example.com";
    process.env.TELEGRAM_BOT_TOKEN = "telegram-test";
    process.env.TELEGRAM_CHAT_ID = "123";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ ok: true, result: { message_id: 99 } }),
      })
    );

    const reportDir = await mkdtemp(join(tmpdir(), "smoke-report-"));
    const report = await runE2eSmoke({ targetUrl: "https://example.com", reportDir });

    expect(report.status).toBe("passed");
    expect(report.steps.find((step) => step.name === "sendgrid_email")).toMatchObject({
      status: "skipped",
      reason: "direct pipeline email is disabled; use reviewed outreach from the admin UI",
    });
    expect(report.steps.find((step) => step.name === "telegram_notification")?.status).toBe("passed");
    expect(report.steps.find((step) => step.name === "stripe_payment_link")?.status).toBe("passed");
    expect(report.outputs.paymentLinkUrl).toBe("https://buy.stripe.com/test");
    expect(sgMail.send).not.toHaveBeenCalled();
  });
});
