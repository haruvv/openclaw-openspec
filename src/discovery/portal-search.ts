import type { LeadSourceInput, RawLeadCandidate } from "./types.js";

interface PortalProfileSeed {
  url: string;
  portalDomain: string;
  query?: string;
  title?: string;
  snippet?: string;
}

interface PortalOfficialLink {
  url: string;
  anchorText: string;
  score: number;
}

const OFFICIAL_LINK_TEXT_PATTERNS = [
  /公式(?:サイト|HP|ホームページ)?/i,
  /ホームページ/i,
  /Webサイト/i,
  /website/i,
  /official/i,
  /店舗サイト/i,
  /事務所サイト/i,
  /医院サイト/i,
];

const BUSINESS_NAME_META_PATTERNS = [
  /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<title[^>]*>([\s\S]*?)<\/title>/i,
  /<h1[^>]*>([\s\S]*?)<\/h1>/i,
];

const EXCLUDED_OFFICIAL_HOST_PATTERNS = [
  "google.com",
  "maps.google.",
  "g.page",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "line.me",
  "lin.ee",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "hotpepper.",
  "ekiten.",
  "yelp.",
  "caloo.",
  "doctorsfile.",
  "medicaldoc.",
  "haisha-yoyaku.",
  "epark.",
  "minnanozeirishi.",
  "zeiri4.",
  "bengo4.",
  "homes.co.jp",
  "suumo.jp",
  "athome.co.jp",
  "reform-guide.",
  "homepro.",
  "reserva.be",
  "airreserve.net",
  "stores.jp",
  "base.shop",
  "thebase.in",
];

export async function discoverPortalSearchCandidates(input: LeadSourceInput): Promise<RawLeadCandidate[]> {
  const configuredDomains = uniqueList(readList(input.env.REVENUE_AGENT_PORTAL_DISCOVERY_DOMAINS).map(normalizeHost).filter(Boolean));
  const configuredUrls = uniqueList(readList(input.env.REVENUE_AGENT_PORTAL_DISCOVERY_URLS).filter((url) => isHttpUrl(url)));
  const profileSeeds: PortalProfileSeed[] = configuredUrls.map((url) => ({
    url,
    portalDomain: normalizeHost(url),
  }));

  if (configuredDomains.length > 0) {
    profileSeeds.push(...await searchPortalDomains(input, configuredDomains));
  }

  const dedupedSeeds = dedupePortalSeeds(profileSeeds).slice(0, input.limit * 3);
  if (dedupedSeeds.length === 0) {
    throw missingConfig("REVENUE_AGENT_PORTAL_DISCOVERY_URLS or portal domain search configuration is required");
  }

  const candidates: RawLeadCandidate[] = [];
  for (const seed of dedupedSeeds) {
    if (candidates.length >= input.limit) break;
    const html = await fetchHtml(seed.url);
    if (!html) continue;
    const candidate = extractPortalCandidateFromHtml(html, seed, input);
    if (candidate) candidates.push(candidate);
  }

  return candidates;
}

export function extractPortalCandidateFromHtml(html: string, seed: PortalProfileSeed, input?: Pick<LeadSourceInput, "queries" | "location">): RawLeadCandidate | null {
  const portalDomain = seed.portalDomain || normalizeHost(seed.url);
  const businessName = cleanBusinessName(extractBusinessName(html) ?? seed.title);
  const phone = extractPhone(html);
  const location = extractLocation(html) ?? input?.location;
  const category = extractCategory(html) ?? inferCategory(input?.queries ?? [], seed.query);
  const officialLink = selectOfficialLink(html, seed.url, portalDomain);
  const profileOnly = !officialLink;

  return {
    source: "portal_search",
    url: officialLink?.url ?? seed.url,
    query: seed.query,
    title: seed.title,
    snippet: seed.snippet,
    businessName,
    category,
    location,
    sourceBusinessId: seed.url,
    confidence: officialLink ? "medium" : "low",
    contactHints: [
      ...(phone ? [{
        type: "phone" as const,
        value: phone,
        sourceUrl: seed.url,
        confidence: "medium" as const,
        label: "Portal phone",
      }] : []),
      {
        type: "manual" as const,
        value: seed.url,
        sourceUrl: seed.url,
        confidence: "low" as const,
        label: "Portal profile",
        reason: profileOnly ? "Official site URL was not found on the portal profile" : "Portal profile used as source provenance",
      },
    ],
    metadata: {
      provider: "portal_search",
      portalUrl: seed.url,
      portalDomain,
      officialUrl: officialLink?.url,
      officialAnchorText: officialLink?.anchorText,
      officialUrlExtracted: Boolean(officialLink),
      profileOnly,
      extractionMethod: officialLink ? "official_link" : "profile_only",
    },
  };
}

async function searchPortalDomains(input: LeadSourceInput, domains: string[]): Promise<PortalProfileSeed[]> {
  if (!input.env.GOOGLE_SEARCH_API_KEY || !input.env.GOOGLE_SEARCH_CX) {
    if (readList(input.env.REVENUE_AGENT_PORTAL_DISCOVERY_URLS).length > 0) return [];
    throw missingConfig("GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX are required to search configured portal domains");
  }

  const seeds: PortalProfileSeed[] = [];
  for (const query of input.queries) {
    for (const domain of domains) {
      const searchQuery = [query, input.location, `site:${domain}`].filter(Boolean).join(" ");
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", input.env.GOOGLE_SEARCH_API_KEY);
      url.searchParams.set("cx", input.env.GOOGLE_SEARCH_CX);
      url.searchParams.set("q", searchQuery);
      url.searchParams.set("num", String(Math.min(input.limit, 10)));
      url.searchParams.set("hl", input.lang);
      url.searchParams.set("gl", input.country);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`portal_search_google_${response.status}`);
      const payload = await response.json() as { items?: Array<{ link?: string; title?: string; snippet?: string }> };
      for (const item of payload.items ?? []) {
        if (!item.link || !isHttpUrl(item.link)) continue;
        seeds.push({
          url: item.link,
          portalDomain: normalizeHost(item.link) || domain,
          query: searchQuery,
          title: item.title,
          snippet: item.snippet,
        });
      }
    }
  }
  return seeds;
}

function selectOfficialLink(html: string, pageUrl: string, portalDomain: string): PortalOfficialLink | null {
  const links = extractAnchorLinks(html, pageUrl);
  const candidates = links.flatMap((link) => {
    const host = normalizeHost(link.url);
    if (!host) return [];
    if (host === portalDomain || host.endsWith(`.${portalDomain}`)) return [];
    if (EXCLUDED_OFFICIAL_HOST_PATTERNS.some((pattern) => host.includes(pattern))) return [];
    const score = scoreOfficialLink(link.anchorText, link.context, link.url);
    if (score <= 0) return [];
    return [{ url: link.url, anchorText: cleanText(link.anchorText), score }];
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function extractAnchorLinks(html: string, pageUrl: string): Array<{ url: string; anchorText: string; context: string }> {
  const links: Array<{ url: string; anchorText: string; context: string }> = [];
  const anchorPattern = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html))) {
    const attrs = match[1] ?? "";
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || /^(mailto|tel|javascript):/i.test(href)) continue;
    const url = toAbsoluteHttpUrl(href, pageUrl);
    if (!url) continue;
    links.push({
      url,
      anchorText: stripHtml(match[2] ?? ""),
      context: stripHtml(`${attrs} ${match[2] ?? ""}`),
    });
  }
  return links;
}

function scoreOfficialLink(anchorText: string, context: string, url: string): number {
  const haystack = `${anchorText} ${context}`;
  let score = OFFICIAL_LINK_TEXT_PATTERNS.some((pattern) => pattern.test(haystack)) ? 5 : 1;
  if (/\/(official|home|site|website)(?:\/|$)/i.test(url)) score += 1;
  if (/予約|reserve|instagram|facebook|SNS/i.test(haystack)) score -= 2;
  return score;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "RevenueAgentPortalDiscovery/1.0",
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml") && !contentType.includes("text/plain")) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function extractBusinessName(html: string): string | undefined {
  for (const pattern of BUSINESS_NAME_META_PATTERNS) {
    const value = html.match(pattern)?.[1];
    if (value) return stripHtml(decodeHtmlEntities(value));
  }
  return undefined;
}

function cleanBusinessName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = cleanText(value)
    .replace(/\s*[｜|].*$/, "")
    .replace(/\s*[-－]\s*(?:公式|ホームページ|ポータル|検索|予約).*$/i, "")
    .trim();
  return cleaned || undefined;
}

function extractPhone(html: string): string | undefined {
  return stripHtml(html).match(/0\d{1,4}[-ー－\s]?\d{1,4}[-ー－\s]?\d{3,4}/)?.[0]?.replace(/[ー－\s]/g, "-");
}

function extractLocation(html: string): string | undefined {
  const plain = stripHtml(html);
  const address = plain.match(/(?:住所|所在地)\s*[:：]?\s*(.*?)(?:0\d{1,4}[-ー－\s]?\d|$)/)?.[1];
  return address ? cleanText(address) : undefined;
}

function extractCategory(html: string): string | undefined {
  const keywords = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1];
  return keywords ? cleanText(decodeHtmlEntities(keywords).split(",")[0] ?? "") : undefined;
}

function inferCategory(queries: string[], query?: string): string | undefined {
  const haystack = [query, ...queries].filter(Boolean).join(" ");
  return haystack.split(/\s+/).find((token) => token && !["公式サイト", "地域密着", "site"].some((word) => token.includes(word)));
}

function toAbsoluteHttpUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeHost(value: string): string {
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]?.replace(/^www\./, "") ?? "";
  }
}

function dedupePortalSeeds(seeds: PortalProfileSeed[]): PortalProfileSeed[] {
  const seen = new Set<string>();
  return seeds.flatMap((seed) => {
    const key = seed.url.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [seed];
  });
}

function readList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function uniqueList(values: string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [value];
  });
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function missingConfig(message: string): Error {
  const err = new Error(message);
  err.name = "MissingLeadSourceConfigError";
  return err;
}
