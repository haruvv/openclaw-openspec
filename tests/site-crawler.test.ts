import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/site-crawler/firecrawl-client.js", () => ({
  scrapeUrl: vi.fn(),
}));
vi.mock("../src/site-crawler/lighthouse-runner.js", () => ({
  measureSeo: vi.fn(),
}));

import { crawlBatch } from "../src/site-crawler/crawler.js";
import { scrapeUrl } from "../src/site-crawler/firecrawl-client.js";
import { measureSeo } from "../src/site-crawler/lighthouse-runner.js";

const mockScrape = vi.mocked(scrapeUrl);
const mockLh = vi.mocked(measureSeo);

describe("crawlBatch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns target when SEO score is below threshold", async () => {
    mockScrape.mockResolvedValue({
      url: "https://example.com",
      domain: "example.com",
      html: "<html></html>",
      title: "Example",
      contactEmail: "info@example.com",
    });
    mockLh.mockResolvedValue({
      url: "https://example.com",
      seoScore: 30,
      diagnostics: [{ id: "document-title", title: "Document lacks title", score: 0, description: "" }],
    });

    const result = await crawlBatch(["https://example.com"]);
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0].seoScore).toBe(30);
    expect(result.targets[0].domain).toBe("example.com");
  });

  it("excludes target when SEO score is above threshold", async () => {
    mockScrape.mockResolvedValue({
      url: "https://good.com",
      domain: "good.com",
      html: `<html><head><title>法人向け会計サービスの導入支援と無料相談 | Good</title><meta name="description" content="会計業務の効率化を支援する法人向けサービスです。導入事例、料金、FAQを確認し、無料相談を予約できます。"></head><body><h1>法人向け会計サービスの導入支援</h1><h2>サービス内容</h2><p>${"会計業務の効率化、請求管理、月次決算、導入支援、運用改善を専門チームが支援します。".repeat(40)}</p><h2>料金と導入事例</h2><p>料金プラン、導入事例、レビュー、お客様の声、認定資格、会社概要、所在地を掲載しています。</p><a href="/contact">無料相談を予約する</a><form><input name="email"></form></body></html>`,
      title: "法人向け会計サービスの導入支援と無料相談 | Good",
      contactEmail: "info@good.com",
    });
    mockLh.mockResolvedValue({ url: "https://good.com", seoScore: 80, diagnostics: [] });

    const result = await crawlBatch(["https://good.com"]);
    expect(result.targets).toHaveLength(0);
  });

  it("skips URL when crawl fails", async () => {
    mockScrape.mockResolvedValue(null);
    const result = await crawlBatch(["https://broken.com"]);
    expect(result.targets).toHaveLength(0);
    expect(result.skipped).toContain("https://broken.com");
  });

  it("skips URL when lighthouse fails", async () => {
    mockScrape.mockResolvedValue({
      url: "https://slow.com",
      domain: "slow.com",
      html: "",
      title: "",
    });
    mockLh.mockResolvedValue(null);
    const result = await crawlBatch(["https://slow.com"]);
    expect(result.targets).toHaveLength(0);
    expect(result.skipped).toContain("https://slow.com");
  });

  it("queues URLs beyond batch limit of 50", async () => {
    mockScrape.mockResolvedValue(null);
    mockLh.mockResolvedValue(null);
    const urls = Array.from({ length: 55 }, (_, i) => `https://site${i}.com`);
    const result = await crawlBatch(urls);
    expect(result.queued).toHaveLength(5);
  });
});
