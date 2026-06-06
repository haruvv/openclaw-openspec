import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    delete process.env.HUNTER_API_KEY;
    delete process.env.HUNTER_API_BASE_URL;
    delete process.env.APOLLO_API_KEY;
    delete process.env.CONTACT_EMAIL_DISCOVERY_DISABLED;
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
      if (url === "https://provider-email.com") {
        return {
          success: true,
          html: `<html><body>
            <h1>Provider Email</h1>
            <a href="/contact">お問い合わせ</a>
          </body></html>`,
        };
      }
      if (url === "https://provider-email.com/contact") {
        return {
          success: true,
          html: `<html><body><form><input name="name"></form></body></html>`,
        };
      }
      if (url === "https://blocked-sales.com") {
        return {
          success: true,
          html: `<html><body>
            <a href="mailto:info@blocked-sales.com">info@blocked-sales.com</a>
            <p>営業目的のご連絡はお断りします。</p>
          </body></html>`,
        };
      }
      return { success: false, error: "not found" };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("uses Hunter fallback when no public email is available", async () => {
    process.env.HUNTER_API_KEY = "hunter-key";
    process.env.HUNTER_API_BASE_URL = "https://hunter.test/domain-search";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: {
        emails: [{
          value: "info@provider-email.com",
          type: "generic",
          confidence: 91,
          verification: { status: "valid" },
        }],
      },
    })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await scrapeUrl("https://provider-email.com");

    expect(fetchMock).toHaveBeenCalled();
    expect(result?.contactEmail).toBe("info@provider-email.com");
    expect(result?.contactMethods).toContainEqual(expect.objectContaining({
      type: "email",
      value: "info@provider-email.com",
      label: "hunter business email",
    }));
    expect(result?.contactMethods).toContainEqual(expect.objectContaining({
      type: "form",
      value: "https://provider-email.com/contact",
    }));
  });

  it("suppresses email discovery and public emails on sales-prohibited sites", async () => {
    process.env.HUNTER_API_KEY = "hunter-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await scrapeUrl("https://blocked-sales.com");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result?.contactEmail).toBeUndefined();
    expect(result?.contactMethods ?? []).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "email" }),
    ]));
  });
});
