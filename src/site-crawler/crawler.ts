import { scrapeUrl } from "./firecrawl-client.js";
import { measureSeo } from "./lighthouse-runner.js";
import { scoreSeoOpportunity } from "./opportunity-scorer.js";
import { normalizeContactMethods } from "../discovery/contact-routing.js";
import { qualifyBusinessSite, qualifySeoIssue } from "../discovery/qualification.js";
import { logger } from "../utils/logger.js";
import type { LighthouseResult, Target } from "../types/index.js";
import { randomUUID } from "node:crypto";
import type { FailureDiagnostic } from "../utils/failure-diagnostics.js";
import type { SiteCandidate } from "../discovery/types.js";

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
  stage: "crawl" | "business" | "contact" | "opportunity";
  reason: string;
}

export interface CrawlWarningDetail extends FailureDiagnostic {
  url: string;
}

export async function crawlBatch(
  urls: Array<string | SiteCandidate>,
  options: { threshold?: number; opportunityThreshold?: number; requireContactEmail?: boolean } = {}
): Promise<CrawlBatchResult> {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const opportunityThreshold = options.opportunityThreshold ?? DEFAULT_OPPORTUNITY_THRESHOLD;
  const batch = urls.slice(0, MAX_BATCH_SIZE);
  const queued = urls.slice(MAX_BATCH_SIZE).map((input) => typeof input === "string" ? input : input.url);

  const targets: Target[] = [];
  const skipped: string[] = [];
  const skipDetails: CrawlSkipDetail[] = [];
  const warnings: CrawlWarningDetail[] = [];

  for (const input of batch) {
    const candidate = typeof input === "string" ? undefined : input;
    const url = typeof input === "string" ? input : input.url;
    if (candidate) {
      const preQualification = qualifyBusinessSite(candidate);
      if (preQualification.status === "held") {
        skipped.push(url);
        skipDetails.push({ url, stage: "business", reason: preQualification.reasonCode });
        logger.info("Holding candidate before crawl", { url, reason: preQualification.reasonCode });
        continue;
      }
    }

    const crawled = await scrapeUrl(url);
    if (!crawled) {
      skipped.push(url);
      skipDetails.push({ url, stage: "crawl", reason: "crawl_failed" });
      logger.warn("Skipping URL (crawl failed)", { url });
      continue;
    }

    if (candidate) {
      const businessQualification = qualifyBusinessSite(candidate, crawled);
      if (businessQualification.status !== "passed") {
        skipped.push(url);
        skipDetails.push({ url, stage: "business", reason: businessQualification.reasonCode });
        logger.info("Skipping candidate (business-site qualification failed)", { url, reason: businessQualification.reasonCode });
        continue;
      }
    }

    const contactMethods = normalizeContactMethods({
      crawl: crawled,
      hints: candidate?.contactHints,
      fallbackUrl: url,
    });

    if (options.requireContactEmail === true && !contactMethods.some((method) => method.type === "email")) {
      skipped.push(url);
      skipDetails.push({ url, stage: "contact", reason: "missing_contact_email" });
      logger.info("Skipping URL (public contact email not found)", {
        url,
        contactMethods: crawled.contactMethods?.length ?? 0,
      });
      continue;
    }

    const measured = await measureSeo(url);
    const lhResult = measured.ok ? measured.result : fallbackLighthouseResult(url, measured.failure);
    if (!measured.ok) {
      warnings.push({ url, ...measured.failure });
      logger.warn("Continuing URL with crawl-only SEO fallback (lighthouse failed)", { url, failure: measured.failure });
    }

    const opportunity = scoreSeoOpportunity(crawled, lhResult);
    const seoQualification = qualifySeoIssue({
      lighthouse: lhResult,
      opportunity,
      seoThreshold: threshold,
      opportunityThreshold,
    });
    if (seoQualification.status !== "passed") {
      skipped.push(url);
      skipDetails.push({
        url,
        stage: "opportunity",
        reason: seoQualification.reasonCode,
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
      contactMethods,
      industry: crawled.industry,
      leadCandidateId: candidate?.id,
      leadSourceProvenance: candidate?.sourceProvenance,
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
