import type { DiscoveryCandidate } from "./job.js";

export async function discoverFirecrawlSearchCandidates(env: NodeJS.ProcessEnv = process.env): Promise<DiscoveryCandidate[]> {
  const queries = readList(env.REVENUE_AGENT_DISCOVERY_QUERIES);
  if (queries.length === 0 || !env.FIRECRAWL_API_KEY) return [];

  const { default: FirecrawlApp } = await import("firecrawl");
  const app = new FirecrawlApp({ apiKey: env.FIRECRAWL_API_KEY });
  const candidates: DiscoveryCandidate[] = [];

  for (const query of queries) {
    const response = await app.search(query, {
      limit: readLimit(env.REVENUE_AGENT_DISCOVERY_SEARCH_LIMIT),
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

function readLimit(value: string | undefined): number {
  const parsed = Number(value ?? 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(Math.floor(parsed), 20);
}
