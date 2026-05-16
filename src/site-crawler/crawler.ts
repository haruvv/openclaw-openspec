import { scrapeUrl } from "./firecrawl-client.js";
import { measureSeo } from "./lighthouse-runner.js";
import { scoreSeoOpportunity } from "./opportunity-scorer.js";
import { logger } from "../utils/logger.js";
import type { LighthouseResult, Target } from "../types/index.js";
import { randomUUID } from "node:crypto";
import type { FailureDiagnostic } from "../utils/failure-diagnostics.js";

const DEFAULT_THRESHOLD = Number(process.env.SEO_SCORE_THRESHOLD ?? 50);
const DEFAULT_OPPORTUNITY_THRESHOLD = Number(process.env.SEO_OPPORTUNITY_SCORE_THRESHOLD ?? 60);
const MAX_BATCH_SIZE = Number(process.env.MAX_BATCH_SIZE ?? 50);

export interface CrawlBatchResult {
  targets: Target[];
  skipped: string[];
  skipDetails: CrawlSkipDetail[];
  warnings: CrawlWarningDetail[];
  queued: string[];
}

export interface CrawlSkipDetail {
  url: string;
  stage: "crawl" | "opportunity";
  reason: string;
}

export interface CrawlWarningDetail extends FailureDiagnostic {
  url: string;
}

export async function crawlBatch(
  urls: string[],
  options: { threshold?: number; opportunityThreshold?: number } = {}
): Promise<CrawlBatchResult> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const opportunityThreshold = options.opportunityThreshold ?? DEFAULT_OPPORTUNITY_THRESHOLD;
  const batch = urls.slice(0, MAX_BATCH_SIZE);
  const queued = urls.slice(MAX_BATCH_SIZE);

  const targets: Target[] = [];
  const skipped: string[] = [];
  const skipDetails: CrawlSkipDetail[] = [];
  const warnings: CrawlWarningDetail[] = [];

  for (const url of batch) {
    const crawled = await scrapeUrl(url);
    if (!crawled) {
      skipped.push(url);
      skipDetails.push({ url, stage: "crawl", reason: "crawl_failed" });
      logger.warn("Skipping URL (crawl failed)", { url });
      continue;
    }

    const measured = await measureSeo(url);
    const lhResult = measured.ok ? measured.result : fallbackLighthouseResult(url, measured.failure);
    if (!measured.ok) {
      warnings.push({ url, ...measured.failure });
      logger.warn("Continuing URL with crawl-only SEO fallback (lighthouse failed)", { url, failure: measured.failure });
    }

    const opportunity = scoreSeoOpportunity(crawled, lhResult);
    if (lhResult.seoScore > threshold && opportunity.opportunityScore < opportunityThreshold) {
      skipped.push(url);
      skipDetails.push({
        url,
        stage: "opportunity",
        reason: `seo_score_${lhResult.seoScore}_above_threshold_${threshold}_and_opportunity_${opportunity.opportunityScore}_below_${opportunityThreshold}`,
      });
      logger.info("URL below opportunity threshold, skipping", {
        url,
        score: lhResult.seoScore,
        threshold,
        opportunityScore: opportunity.opportunityScore,
        opportunityThreshold,
      });
      continue;
    }

    const now = Date.now();
    targets.push({
      id: randomUUID(),
      url,
      domain: crawled.domain,
      contactEmail: crawled.contactEmail,
      contactMethods: crawled.contactMethods,
      industry: crawled.industry,
      seoScore: lhResult.seoScore,
      diagnostics: lhResult.diagnostics,
      opportunityScore: opportunity.opportunityScore,
      opportunityFindings: opportunity.findings,
      status: "crawled",
      createdAt: now,
      updatedAt: now,
    });
  }

  logger.info("Batch complete", {
    total: batch.length,
    targets: targets.length,
    skipped: skipped.length,
    queued: queued.length,
  });

  return { targets, skipped, skipDetails, warnings, queued };
}

function fallbackLighthouseResult(url: string, failure: FailureDiagnostic): LighthouseResult {
  return {
    url,
    seoScore: 0,
    diagnostics: [
      {
        id: "lighthouse-unavailable",
        title: "Lighthouse measurement unavailable",
        score: 0,
        description: `Lighthouse did not complete for this run (${failure.reason}: ${failure.message}), so the crawler continued with crawl-only fallback scoring.`,
      },
    ],
  };
}
