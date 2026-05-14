import { validateSafeTargetUrl } from "../revenue-agent/security.js";
import type { RevenueAgentRunOptions, RevenueAgentRunReport } from "../revenue-agent/types.js";
import { listSites } from "../sites/repository.js";
import type { SiteRecord } from "../sites/types.js";
import { discoverFirecrawlSearchCandidates } from "./firecrawl-search.js";

export interface DiscoveryCandidate {
  url: string;
  source: "seed" | "firecrawl_search";
  query?: string;
  title?: string;
}

export interface DailyDiscoveryReport {
  status: "disabled" | "skipped" | "passed" | "failed";
  enabled: boolean;
  quota: number;
  candidateCount: number;
  selectedCount: number;
  skipped: Array<{ url: string; reason: string }>;
  runs: Array<{ url: string; runId: string; status: RevenueAgentRunReport["status"] }>;
}

interface DailyDiscoveryJobOptions {
  env?: NodeJS.ProcessEnv;
  enabled?: boolean;
  discoverCandidates?: (env: NodeJS.ProcessEnv) => Promise<DiscoveryCandidate[]>;
  listExistingSites?: () => Promise<SiteRecord[]>;
  runAgent?: (options: RevenueAgentRunOptions) => Promise<RevenueAgentRunReport>;
  validateUrl?: typeof validateSafeTargetUrl;
}

export async function runDailyDiscoveryJob(options: DailyDiscoveryJobOptions = {}): Promise<DailyDiscoveryReport> {
  const env = options.env ?? process.env;
  const enabled = options.enabled ?? env.REVENUE_AGENT_DISCOVERY_ENABLED === "true";
  const quota = readQuota(env.REVENUE_AGENT_DISCOVERY_DAILY_QUOTA);
  const seedCandidates = readSeedCandidates(env.REVENUE_AGENT_DISCOVERY_SEED_URLS);
  const skipped: DailyDiscoveryReport["skipped"] = [];
  const runs: DailyDiscoveryReport["runs"] = [];

  if (!enabled) {
    return {
      status: "disabled",
      enabled,
      quota,
      candidateCount: seedCandidates.length,
      selectedCount: 0,
      skipped,
      runs,
    };
  }

  const discoverCandidates = options.discoverCandidates ?? discoverFirecrawlSearchCandidates;
  const candidates = mergeCandidates(seedCandidates, await discoverCandidates(env));

  if (candidates.length === 0) {
    return {
      status: "skipped",
      enabled,
      quota,
      candidateCount: 0,
      selectedCount: 0,
      skipped: [{ url: "-", reason: "REVENUE_AGENT_DISCOVERY_SEED_URLS is empty" }],
      runs,
    };
  }

  const listExistingSites = options.listExistingSites ?? listSites;
  const existingSites = await listExistingSites();
  const seen = new Set(existingSites.map((site) => normalizeComparableUrl(site.normalizedUrl || site.displayUrl)));
  const selected: DiscoveryCandidate[] = [];

  for (const candidate of candidates) {
    if (selected.length >= quota) break;
    const normalized = normalizeComparableUrl(candidate.url);
    if (seen.has(normalized)) {
      skipped.push({ url: candidate.url, reason: "already_analyzed" });
      continue;
    }

    const validateUrl = options.validateUrl ?? validateSafeTargetUrl;
    const safeUrl = await validateUrl(candidate.url);
    if (!safeUrl.ok) {
      skipped.push({ url: candidate.url, reason: safeUrl.error });
      continue;
    }

    selected.push({ ...candidate, url: safeUrl.url });
    seen.add(normalized);
  }

  const runAgent = options.runAgent ?? (await import("../revenue-agent/runner.js")).runRevenueAgent;
  for (const candidate of selected) {
    const report = await runAgent({
      targetUrl: candidate.url,
      source: "discovery",
      sendEmail: false,
      sendTelegram: false,
      createPaymentLink: false,
      metadata: { discovery: { source: candidate.source, query: candidate.query, title: candidate.title } },
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
    runs,
  };
}

function readQuota(value: string | undefined): number {
  const parsed = Number(value ?? 3);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return Math.min(Math.floor(parsed), 10);
}

function readSeedCandidates(value: string | undefined): DiscoveryCandidate[] {
  if (!value) return [];
  const seen = new Set<string>();
  const urls = value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return urls.flatMap((url) => {
    const normalized = normalizeComparableUrl(url);
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    return [{ url, source: "seed" as const }];
  });
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
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return value.trim();
  }
}
