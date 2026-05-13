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
  crawlBatch: vi.fn().mockResolvedValue({ targets: [target], skipped: [], queued: [] }),
}));

vi.mock("../src/proposal-generator/generator.js", () => ({
  generateProposal: vi.fn().mockResolvedValue("## 現状スコア\n\n## 課題一覧\n\n## 改善提案"),
}));

vi.mock("../src/proposal-generator/storage.js", () => ({
  saveProposal: vi.fn().mockResolvedValue("./output/proposals/example.com.md"),
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
    expect(saved.steps).toHaveLength(5);
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
});
