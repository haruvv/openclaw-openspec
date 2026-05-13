import FirecrawlApp from "firecrawl";
import { logger } from "../utils/logger.js";
import type { CrawlResult } from "../types/index.js";

const client = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

export async function scrapeUrl(url: string): Promise<CrawlResult | null> {
  try {
    const result = await client.scrapeUrl(url, {
      formats: ["html", "markdown"],
      actions: [],
    });

    if (!result.success) {
      logger.warn("Firecrawl scrape failed", { url, error: result.error });
      return null;
    }

    const domain = new URL(url).hostname;
    const contactEmail = extractEmail(result.html ?? "");
    const title = extractTitle(result.html ?? "");

    return {
      url,
      domain,
      html: result.html ?? "",
      title,
      contactEmail,
    };
  } catch (err) {
    logger.error("Firecrawl error", { url, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

function extractEmail(html: string): string | undefined {
  const match = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match?.[0];
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? "";
}
