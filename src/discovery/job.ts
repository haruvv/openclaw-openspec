import { validateSafeTargetUrl } from "../revenue-agent/security.js";
import type { RevenueAgentRunOptions, RevenueAgentRunReport } from "../revenue-agent/types.js";
import { listSites } from "../sites/repository.js";
import type { SiteRecord } from "../sites/types.js";
import { buildDefaultLeadSourceAdapters, executeLeadSourceAdapters, readEnabledSources } from "./adapters.js";
import { mergeSiteCandidates, normalizeComparableUrl as normalizeLeadComparableUrl, normalizeRawLeadCandidate } from "./normalization.js";
import { qualifyApolloCompanySizeFit, qualifyBusinessSite, qualifySmallBusinessFit } from "./qualification.js";
import { upsertLeadCandidate } from "./repository.js";
import { scoreLeadPriority } from "./priority.js";
import type { LeadSourceAdapter, LeadSourceId, LeadSourceRunReport, SiteCandidate } from "./types.js";

export interface DiscoveryCandidate {
  url: string;
  source: LeadSourceId;
  query?: string;
  title?: string;
}

export type CandidateContactEmailCheck =
  | { ok: true; contactEmail: string }
  | { ok: false; reason: string };

export interface DailyDiscoveryReport {
  status: "disabled" | "skipped" | "passed" | "failed";
  enabled: boolean;
  quota: number;
  candidateCount: number;
  selectedCount: number;
  skipped: Array<{ url: string; reason: string }>;
  sources: LeadSourceRunReport[];
  runs: Array<{ url: string; runId: string; status: RevenueAgentRunReport["status"] }>;
}

interface DailyDiscoveryJobOptions {
  env?: NodeJS.ProcessEnv;
  enabled?: boolean;
  discoverCandidates?: (env: NodeJS.ProcessEnv) => Promise<DiscoveryCandidate[]>;
  sourceAdapters?: LeadSourceAdapter[];
  persistCandidates?: boolean;
  listExistingSites?: () => Promise<SiteRecord[]>;
  runAgent?: (options: RevenueAgentRunOptions) => Promise<RevenueAgentRunReport>;
  validateUrl?: typeof validateSafeTargetUrl;
  checkContactEmail?: (candidate: DiscoveryCandidate, env: NodeJS.ProcessEnv) => Promise<CandidateContactEmailCheck>;
  requireContactEmail?: boolean;
}

export async function runDailyDiscoveryJob(options: DailyDiscoveryJobOptions = {}): Promise<DailyDiscoveryReport> {
  const env = options.env ?? process.env;
  const enabled = options.enabled ?? env.REVENUE_AGENT_DISCOVERY_ENABLED === "true";
  const quota = readQuota(env.REVENUE_AGENT_DISCOVERY_DAILY_QUOTA);
  const seedCandidates = readSeedCandidates(env.REVENUE_AGENT_DISCOVERY_SEED_URLS);
  const searchQueries = readList(env.REVENUE_AGENT_DISCOVERY_QUERIES);
  const requireContactEmail = options.requireContactEmail ?? env.REVENUE_AGENT_DISCOVERY_REQUIRE_EMAIL === "true";
  const skipped: DailyDiscoveryReport["skipped"] = [];
  const sources: LeadSourceRunReport[] = [];
  const runs: DailyDiscoveryReport["runs"] = [];

  if (!enabled) {
    return {
      status: "disabled",
      enabled,
      quota,
      candidateCount: seedCandidates.length,
      selectedCount: 0,
      skipped,
      sources,
      runs,
    };
  }

  const { candidates, siteCandidates, sourceReports } = await discoverCandidateSet({
    env,
    seedCandidates,
    searchQueries,
    discoverCandidates: options.discoverCandidates,
    sourceAdapters: options.sourceAdapters,
  });
  sources.push(...sourceReports);

  if (siteCandidates.length === 0) {
    return {
      status: "skipped",
      enabled,
      quota,
      candidateCount: 0,
      selectedCount: 0,
      skipped: [{ url: "-", reason: searchQueries.length === 0 && seedCandidates.length === 0 ? "discovery_sources_empty" : "no_candidates_found" }],
      sources,
      runs,
    };
  }

  const listExistingSites = options.listExistingSites ?? listSites;
  const existingSites = await listExistingSites();
  const seen = new Set(existingSites.map((site) => normalizeComparableUrl(site.normalizedUrl || site.displayUrl)));
  const selected: SiteCandidate[] = [];
  const scoredCandidates = siteCandidates
    .map((candidate) => ({ candidate, score: scoreLeadPriority({ candidate, manualCapacityAvailable: true }) }))
    .sort((a, b) => b.score.total - a.score.total)
    .map((entry) => entry.candidate);

  for (const candidate of scoredCandidates) {
    if (selected.length >= quota) break;
    const normalized = normalizeComparableUrl(candidate.url);
    if (seen.has(normalized)) {
      skipped.push({ url: candidate.url, reason: "already_analyzed" });
      continue;
    }

    const businessSiteFit = qualifyBusinessSite(candidate);
    if (businessSiteFit.status === "held") {
      skipped.push({ url: candidate.url, reason: businessSiteFit.reasonCode });
      continue;
    }

    const smallBusinessFit = qualifySmallBusinessFit(candidate);
    if (smallBusinessFit.status !== "passed") {
      skipped.push({ url: candidate.url, reason: smallBusinessFit.reasonCode });
      continue;
    }

    const apolloCompanySizeFit = await qualifyApolloCompanySizeFit(candidate, env);
    if (apolloCompanySizeFit.status !== "passed") {
      skipped.push({ url: candidate.url, reason: apolloCompanySizeFit.reasonCode });
      continue;
    }

    const validateUrl = options.validateUrl ?? validateSafeTargetUrl;
    const safeUrl = await validateUrl(candidate.url);
    if (!safeUrl.ok) {
      skipped.push({ url: candidate.url, reason: safeUrl.error });
      continue;
    }

    if (requireContactEmail) {
      const checkContactEmail = options.checkContactEmail ?? defaultCheckContactEmail;
      const contact = await checkContactEmail({
        url: safeUrl.url,
        source: candidate.sourceProvenance[0]?.source ?? "seed",
        query: candidate.sourceProvenance.find((source) => source.query)?.query,
        title: candidate.sourceProvenance.find((source) => source.title)?.title,
      }, env);
      if (!contact.ok) {
        skipped.push({ url: candidate.url, reason: contact.reason });
        continue;
      }
    }

    selected.push({ ...candidate, url: safeUrl.url });
    seen.add(normalized);
  }

  if (options.persistCandidates ?? env.REVENUE_AGENT_DISCOVERY_PERSIST_LEADS === "true") {
    await Promise.all(selected.map((candidate) => upsertLeadCandidate(candidate).catch(() => candidate)));
  }

  const runAgent = options.runAgent ?? (await import("../revenue-agent/runner.js")).runRevenueAgent;
  for (const candidate of selected) {
    const report = await runAgent({
      targetUrl: candidate.url,
      source: "discovery",
      sendEmail: false,
      sendTelegram: false,
      createPaymentLink: false,
      metadata: {
        discovery: {
          candidateId: candidate.id,
          sources: candidate.sourceProvenance.map((source) => source.source),
          primarySource: candidate.sourceProvenance[0]?.source,
          query: candidate.sourceProvenance.find((source) => source.query)?.query,
          title: candidate.sourceProvenance.find((source) => source.title)?.title,
          provenance: candidate.sourceProvenance,
          businessName: candidate.businessName,
          category: candidate.category,
          location: candidate.location,
          contactHints: candidate.contactHints,
        },
      },
    });
    runs.push({ url: candidate.url, runId: report.id, status: report.status });
  }

  return {
    status: runs.some((run) => run.status === "failed") ? "failed" : "passed",
    enabled,
    quota,
    candidateCount: candidates.length,
    selectedCount: selected.length,
    skipped,
    sources,
    runs,
  };
}

async function discoverCandidateSet(input: {
  env: NodeJS.ProcessEnv;
  seedCandidates: DiscoveryCandidate[];
  searchQueries: string[];
  discoverCandidates?: (env: NodeJS.ProcessEnv) => Promise<DiscoveryCandidate[]>;
  sourceAdapters?: LeadSourceAdapter[];
}): Promise<{ candidates: DiscoveryCandidate[]; siteCandidates: SiteCandidate[]; sourceReports: LeadSourceRunReport[] }> {
  if (input.discoverCandidates) {
    const candidates = mergeCandidates(input.seedCandidates, await input.discoverCandidates(input.env));
    const siteCandidates = mergeSiteCandidates(
      candidates.flatMap((candidate) => {
        const normalized = normalizeRawLeadCandidate({
          source: candidate.source,
          url: candidate.url,
          query: candidate.query,
          title: candidate.title,
        });
        return normalized ? [normalized] : [];
      }),
    );
    return {
      candidates,
      siteCandidates,
      sourceReports: [{ source: "firecrawl_search", status: "passed", candidateCount: candidates.length }],
    };
  }

  const sourceAdapters = input.sourceAdapters ?? buildDefaultLeadSourceAdapters(readEnabledSources(input.env.REVENUE_AGENT_DISCOVERY_SOURCES));
  const sourceResults = await executeLeadSourceAdapters(sourceAdapters, {
    queries: input.searchQueries,
    seedUrls: readList(input.env.REVENUE_AGENT_DISCOVERY_SEED_URLS),
    limit: readLimit(input.env.REVENUE_AGENT_DISCOVERY_SOURCE_LIMIT ?? input.env.REVENUE_AGENT_DISCOVERY_SEARCH_LIMIT),
    country: input.env.REVENUE_AGENT_DISCOVERY_SEARCH_COUNTRY ?? "jp",
    lang: input.env.REVENUE_AGENT_DISCOVERY_SEARCH_LANG ?? "ja",
    location: input.env.REVENUE_AGENT_DISCOVERY_SEARCH_LOCATION ?? "",
    env: input.env,
  });
  const siteCandidates = mergeSiteCandidates(
    sourceResults.flatMap((result) => result.candidates.flatMap((candidate) => {
      const normalized = normalizeRawLeadCandidate(candidate);
      return normalized ? [normalized] : [];
    })),
  );
  return {
    candidates: siteCandidates.map((candidate): DiscoveryCandidate => ({
      url: candidate.url,
      source: candidate.sourceProvenance[0]?.source ?? "seed",
      query: candidate.sourceProvenance.find((source) => source.query)?.query,
      title: candidate.sourceProvenance.find((source) => source.title)?.title,
    })),
    siteCandidates,
    sourceReports: sourceResults.map((result) => result.report),
  };
}

function readQuota(value: string | undefined): number {
  const parsed = Number(value ?? 3);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return Math.min(Math.floor(parsed), 10);
}

function readSeedCandidates(value: string | undefined): DiscoveryCandidate[] {
  const seen = new Set<string>();
  const urls = readList(value);

  return urls.flatMap((url) => {
    const normalized = normalizeComparableUrl(url);
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    return [{ url, source: "seed" as const }];
  });
}

function readList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function mergeCandidates(...groups: DiscoveryCandidate[][]): DiscoveryCandidate[] {
  const seen = new Set<string>();
  return groups.flat().flatMap((candidate) => {
    const normalized = normalizeComparableUrl(candidate.url);
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    return [candidate];
  });
}

export function normalizeComparableUrl(value: string): string {
  return normalizeLeadComparableUrl(value);
}

function readLimit(value: string | undefined): number {
  const parsed = Number(value ?? 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(Math.floor(parsed), 50);
}

async function defaultCheckContactEmail(candidate: DiscoveryCandidate, env: NodeJS.ProcessEnv): Promise<CandidateContactEmailCheck> {
  if (!env.FIRECRAWL_API_KEY) {
    return { ok: false, reason: "FIRECRAWL_API_KEY is not set" };
  }

  const { scrapeUrl } = await import("../site-crawler/firecrawl-client.js");
  const crawled = await scrapeUrl(candidate.url);
  if (!crawled) {
    return { ok: false, reason: "crawl_failed" };
  }
  if (!crawled.contactEmail) {
    return { ok: false, reason: "missing_contact_email" };
  }

  return { ok: true, contactEmail: crawled.contactEmail };
}
