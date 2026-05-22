import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { logger } from "../utils/logger.js";
import type { LighthouseResult, SeoDiagnostic } from "../types/index.js";
import { buildFailureDiagnostic, type FailureDiagnostic } from "../utils/failure-diagnostics.js";

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const CHROME_PATH = process.env.CHROME_PATH ?? defaultChromePath();

export type LighthouseMeasurement =
  | { ok: true; result: LighthouseResult; durationMs: number }
  | { ok: false; failure: FailureDiagnostic };

export async function measureSeo(url: string): Promise<LighthouseMeasurement> {
  const started = Date.now();
  const timeoutMs = lighthouseTimeoutMs();
  try {
    const { stdout } = await runLighthouse(url, timeoutMs);

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

function runLighthouse(url: string, timeoutMs: number): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      "npx",
      [
        "lighthouse",
        url,
        "--chrome-path",
        CHROME_PATH,
        "--output=json",
        "--only-categories=seo",
        "--quiet",
        "--no-enable-error-reporting",
        "--chrome-flags=--headless --no-sandbox --disable-gpu --disable-dev-shm-usage",
      ],
      {
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: lighthouseMaxBufferBytes(),
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(withLighthouseProcessContext(error, { url, timeoutMs, stdout, stderr }));
          return;
        }

        resolve({ stdout: String(stdout) });
      },
    );
  });
}

function lighthouseTimeoutMs(): number {
  const value = Number(process.env.LIGHTHOUSE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

function lighthouseMaxBufferBytes(): number {
  const value = Number(process.env.LIGHTHOUSE_MAX_BUFFER_BYTES ?? DEFAULT_MAX_BUFFER_BYTES);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_BUFFER_BYTES;
}

function withLighthouseProcessContext(
  error: Error,
  context: { url: string; timeoutMs: number; stdout: string | Buffer; stderr: string | Buffer },
): Error {
  const record = error as Error & {
    code?: string | number;
    killed?: boolean;
    signal?: string;
    stdout?: string;
    stderr?: string;
  };

  const output = {
    code: record.code,
    signal: record.signal,
    stdout: String(context.stdout),
    stderr: String(context.stderr),
  };

  if (record.killed || record.code === "ETIMEDOUT") {
    const timeout = new Error(`Lighthouse timeout after ${context.timeoutMs}ms for ${context.url}`);
    Object.assign(timeout, output, { name: "LighthouseTimeoutError" });
    return timeout;
  }

  Object.assign(record, output);
  return record;
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
