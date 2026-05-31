import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockScrapeUrl } = vi.hoisted(() => ({
  mockScrapeUrl: vi.fn(),
}));

vi.mock("firecrawl", () => ({
  default: vi.fn().mockImplementation(() => ({
    scrapeUrl: mockScrapeUrl,
  })),
}));

import { scrapeUrl } from "../src/site-crawler/firecrawl-client.js";

describe("scrapeUrl contact discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrapeUrl.mockImplementation(async (url: string) => {
      if (url === "https://example.com") {
        return {
          success: true,
          html: `<html>
            <head><title>Example</title></head>
            <body>
              <a href="/contact">お問い合わせ</a>
              <a href="/about">会社概要</a>
            </body>
          </html>`,
        };
      }
      if (url === "https://example.com/contact") {
        return {
          success: true,
          html: `<html><body>
            <a href="mailto:info@example.co.jp">info@example.co.jp</a>
            <form><input name="name"></form>
          </body></html>`,
        };
      }
      if (url === "https://example.com/about") {
        return {
          success: true,
          html: `<html><body>電話 03-1234-5678</body></html>`,
        };
      }
      if (url === "https://noise.com") {
        return {
          success: true,
          html: `<html><body>
            <div>frame-6e1bf3ae0b2856fc7573880f173c0b88@mhtml.blink</div>
            <form><input name="email"></form>
          </body></html>`,
        };
      }
      return { success: false, error: "not found" };
    });
  });

  it("scrapes likely contact pages and returns ranked contact methods", async () => {
    const result = await scrapeUrl("https://example.com");

    expect(result).toMatchObject({
      domain: "example.com",
      title: "Example",
      contactEmail: "info@example.co.jp",
    });
    expect(result?.contactMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "email",
          value: "info@example.co.jp",
          sourceUrl: "https://example.com/contact",
          confidence: "high",
        }),
        expect.objectContaining({
          type: "form",
          value: "https://example.com/contact",
          confidence: "high",
        }),
        expect.objectContaining({
          type: "phone",
          value: "03-1234-5678",
        }),
      ]),
    );
  });

  it("ignores Chromium MHTML frame identifiers that look like email addresses", async () => {
    const result = await scrapeUrl("https://noise.com");

    expect(result?.contactEmail).toBeUndefined();
    expect(result?.contactMethods ?? []).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "email",
          value: "frame-6e1bf3ae0b2856fc7573880f173c0b88@mhtml.blink",
        }),
      ]),
    );
  });
});
