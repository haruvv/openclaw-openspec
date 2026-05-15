import { describe, expect, it } from "vitest";
import { scoreSeoOpportunity } from "../src/site-crawler/opportunity-scorer.js";

describe("scoreSeoOpportunity", () => {
  it("finds outreach opportunities even when Lighthouse SEO is perfect", () => {
    const result = scoreSeoOpportunity(
      {
        url: "https://example.com",
        domain: "example.com",
        title: "Example",
        html: `
          <html>
            <head><title>Example</title><meta name="description" content="Example"></head>
            <body>
              <h1>Example</h1>
              <p>Welcome.</p>
            </body>
          </html>
        `,
      },
      { url: "https://example.com", seoScore: 100, diagnostics: [] },
    );

    expect(result.opportunityScore).toBeGreaterThanOrEqual(60);
    expect(result.findings.map((finding) => finding.category)).toEqual(
      expect.arrayContaining(["content", "conversion", "trust"]),
    );
  });

  it("returns a low opportunity score for a complete service page", () => {
    const result = scoreSeoOpportunity(
      {
        url: "https://example.com",
        domain: "example.com",
        title: "法人向け会計サービスの導入支援と無料相談 | Example",
        contactEmail: "info@example.com",
        html: `
          <html>
            <head>
              <title>法人向け会計サービスの導入支援と無料相談 | Example</title>
              <meta name="description" content="会計業務の効率化を支援する法人向けサービスです。導入事例、料金、FAQを確認し、無料相談を予約できます。">
            </head>
            <body>
              <h1>法人向け会計サービスの導入支援</h1>
              <h2>サービス内容</h2>
              <p>${"会計業務の効率化、請求管理、月次決算、導入支援、運用改善を専門チームが支援します。".repeat(40)}</p>
              <h2>料金と導入事例</h2>
              <p>料金プラン、導入事例、レビュー、お客様の声、認定資格、会社概要、所在地を掲載しています。</p>
              <a href="/contact">無料相談を予約する</a>
              <form><input name="email"></form>
            </body>
          </html>
        `,
      },
      { url: "https://example.com", seoScore: 100, diagnostics: [] },
    );

    expect(result.opportunityScore).toBeLessThan(30);
  });
});
