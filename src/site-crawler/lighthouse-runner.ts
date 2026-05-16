import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";
import type { LighthouseResult, SeoDiagnostic } from "../types/index.js";
import { buildFailureDiagnostic, type FailureDiagnostic } from "../utils/failure-diagnostics.js";

const execFileAsync = promisify(execFile);
const DEFAULT_TIMEOUT_MS = 90_000;
const CHROME_PATH = process.env.CHROME_PATH ?? defaultChromePath();

export type LighthouseMeasurement =
  | { ok: true; result: LighthouseResult; durationMs: number }
  | { ok: false; failure: FailureDiagnostic };

export async function measureSeo(url: string): Promise<LighthouseMeasurement> {
  const started = Date.now();
  const timeoutMs = lighthouseTimeoutMs();
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
        "--chrome-flags=--headless --no-sandbox --disable-gpu --disable-dev-shm-usage",
      ]),
      timeout(timeoutMs, url),
    ]);

    let report: LhReport;
    try {
      report = JSON.parse(stdout) as LhReport;
    } catch (err) {
      const failure = buildFailureDiagnostic(err, {
        stage: "lighthouse",
        reason: "parse_error",
        durationMs: Date.now() - started,
        retryable: false,
      });
      logger.error("Lighthouse report parse failed", { url, failure });
      return { ok: false, failure };
    }
    const seoScore = Math.round((report.categories.seo?.score ?? 0) * 100);
    const diagnostics = extractDiagnostics(report);

    return { ok: true, result: { url, seoScore, diagnostics }, durationMs: Date.now() - started };
  } catch (err) {
    const failure = buildFailureDiagnostic(err, {
      stage: "lighthouse",
      durationMs: Date.now() - started,
      retryable: true,
    });
    logger.error("Lighthouse measurement failed", { url, failure });
    return { ok: false, failure };
  }
}

function timeout(ms: number, url: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Lighthouse timeout after ${ms}ms for ${url}`)), ms)
  );
}

function lighthouseTimeoutMs(): number {
  const value = Number(process.env.LIGHTHOUSE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
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

function defaultChromePath(): string {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ];
  return candidates.find((path) => existsSync(path)) ?? "/usr/bin/chromium";
}
