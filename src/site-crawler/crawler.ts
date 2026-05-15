import { scrapeUrl } from "./firecrawl-client.js";
import { measureSeo } from "./lighthouse-runner.js";
import { scoreSeoOpportunity } from "./opportunity-scorer.js";
import { logger } from "../utils/logger.js";
import type { Target } from "../types/index.js";
import { randomUUID } from "node:crypto";

const DEFAULT_THRESHOLD = Number(process.env.SEO_SCORE_THRESHOLD ?? 50);
const DEFAULT_OPPORTUNITY_THRESHOLD = Number(process.env.SEO_OPPORTUNITY_SCORE_THRESHOLD ?? 60);
const MAX_BATCH_SIZE = Number(process.env.MAX_BATCH_SIZE ?? 50);

export interface CrawlBatchResult {
  targets: Target[];
  skipped: string[];
  queued: string[];
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

  for (const url of batch) {
    const crawled = await scrapeUrl(url);
    if (!crawled) {
      skipped.push(url);
      logger.warn("Skipping URL (crawl failed)", { url });
      continue;
    }

    const lhResult = await measureSeo(url);
    if (!lhResult) {
      skipped.push(url);
      logger.warn("Skipping URL (lighthouse failed)", { url });
      continue;
    }

    const opportunity = scoreSeoOpportunity(crawled, lhResult);
    if (lhResult.seoScore > threshold && opportunity.opportunityScore < opportunityThreshold) {
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

  return { targets, skipped, queued };
}
