import type { DiscoveryCandidate } from "./job.js";

export async function discoverFirecrawlSearchCandidates(env: NodeJS.ProcessEnv = process.env): Promise<DiscoveryCandidate[]> {
  const queries = readList(env.REVENUE_AGENT_DISCOVERY_QUERIES);
  if (queries.length === 0 || !env.FIRECRAWL_API_KEY) return [];

  const { default: FirecrawlApp } = await import("firecrawl");
  const app = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
  const candidates: DiscoveryCandidate[] = [];

  for (const query of queries) {
    const response = await app.search(query, {
      limit: readLimit(env),
      country: env.REVENUE_AGENT_DISCOVERY_SEARCH_COUNTRY ?? "jp",
      lang: env.REVENUE_AGENT_DISCOVERY_SEARCH_LANG ?? "ja",
      location: env.REVENUE_AGENT_DISCOVERY_SEARCH_LOCATION,
      scrapeOptions: { formats: [] },
    });

    if (!response.success) continue;

    for (const item of response.data) {
      const url = item.url ?? item.metadata?.sourceURL;
      if (!url) continue;
      candidates.push({
        url,
        source: "firecrawl_search",
        query,
        title: item.metadata?.title,
      });
    }
  }

  return candidates;
}

function readList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readLimit(env: NodeJS.ProcessEnv): number {
  const configured = Number(env.REVENUE_AGENT_DISCOVERY_SEARCH_LIMIT ?? 10);
  const parsed = Number.isFinite(configured) && configured > 0 ? configured : 10;
  const quota = Number(env.REVENUE_AGENT_DISCOVERY_DAILY_QUOTA ?? 3);
  const overfetchFactor = Number(env.REVENUE_AGENT_DISCOVERY_SEARCH_OVERFETCH_FACTOR ?? 10);
  const overfetchTarget = Number.isFinite(quota) && Number.isFinite(overfetchFactor)
    ? Math.max(1, Math.floor(quota) * Math.max(1, Math.floor(overfetchFactor)))
    : 30;
  return Math.min(Math.max(Math.floor(parsed), overfetchTarget), 50);
}
