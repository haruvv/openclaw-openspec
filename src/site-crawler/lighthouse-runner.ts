import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";
import type { LighthouseResult, SeoDiagnostic } from "../types/index.js";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 30_000;
const CHROME_PATH = process.env.CHROME_PATH ?? "/usr/bin/chromium";

export async function measureSeo(url: string): Promise<LighthouseResult | null> {
  try {
    const { stdout } = await Promise.race([
      execFileAsync("npx", [
        "lighthouse",
        url,
        "--chrome-path",
        CHROME_PATH,
        "--output=json",
        "--only-categories=seo",
        "--quiet",
        "--no-enable-error-reporting",
        "--chrome-flags=--headless --no-sandbox --disable-gpu",
      ]),
      timeout(TIMEOUT_MS, url),
    ]);

    const report = JSON.parse(stdout) as LhReport;
    const seoScore = Math.round((report.categories.seo?.score ?? 0) * 100);
    const diagnostics = extractDiagnostics(report);

    return { url, seoScore, diagnostics };
  } catch (err) {
    logger.error("Lighthouse measurement failed", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function timeout(ms: number, url: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Lighthouse timeout after ${ms}ms for ${url}`)), ms)
  );
}

function extractDiagnostics(report: LhReport): SeoDiagnostic[] {
  return Object.values(report.audits)
    .filter((a) => a.id.startsWith("meta") || SEO_AUDIT_IDS.has(a.id))
    .map((a) => ({
      id: a.id,
      title: a.title,
      score: a.score,
      description: a.description,
    }));
}

const SEO_AUDIT_IDS = new Set([
  "document-title",
  "meta-description",
  "http-status-code",
  "link-text",
  "crawlable-anchors",
  "is-crawlable",
  "robots-txt",
  "image-alt",
  "hreflang",
  "canonical",
  "structured-data",
  "font-size",
  "tap-targets",
]);

interface LhReport {
  categories: { seo?: { score: number } };
  audits: Record<string, { id: string; title: string; score: number | null; description: string }>;
}
