import { discoverFirecrawlSearchCandidates } from "./firecrawl-search.js";
import { discoverPortalSearchCandidates } from "./portal-search.js";
import type {
  LeadDiscoveryContext,
  LeadSourceAdapter,
  LeadSourceExecutionResult,
  LeadSourceId,
  LeadSourceInput,
  RawLeadCandidate,
} from "./types.js";

export const DEFAULT_DISCOVERY_SOURCES: LeadSourceId[] = ["seed", "firecrawl_search", "google_search", "google_maps", "portal_search", "apollo_organization", "technology_intelligence"];
const DEFAULT_PRIMARY_DISCOVERY_SOURCES: LeadSourceId[] = ["seed", "firecrawl_search", "google_maps"];

export async function executeLeadSourceAdapters(
  adapters: LeadSourceAdapter[],
  input: LeadSourceInput,
  context: LeadDiscoveryContext = { now: new Date() },
): Promise<LeadSourceExecutionResult[]> {
  const results: LeadSourceExecutionResult[] = [];
  for (const adapter of adapters) {
    try {
      const candidates = await adapter.discover(input, context);
      results.push({
        report: { source: adapter.id, status: "passed", candidateCount: candidates.length },
        candidates,
      });
    } catch (err) {
      results.push({
        report: {
          source: adapter.id,
          status: isMissingConfigError(err) ? "skipped" : "failed",
          candidateCount: 0,
          reason: err instanceof Error ? err.message : "source_failed",
        },
        candidates: [],
      });
    }
  }
  return results;
}

export function buildDefaultLeadSourceAdapters(enabledSources: LeadSourceId[]): LeadSourceAdapter[] {
  const enabled = new Set(enabledSources);
  return [
    seedSourceAdapter,
    firecrawlSearchSourceAdapter,
    googleSearchSourceAdapter,
    googleMapsSourceAdapter,
    portalSearchSourceAdapter,
    apolloOrganizationSourceAdapter,
    technologyIntelligenceSourceAdapter,
  ].filter((adapter) => enabled.has(adapter.id));
}

export const seedSourceAdapter: LeadSourceAdapter = {
  id: "seed",
  async discover(input) {
    return input.seedUrls.map((url): RawLeadCandidate => ({
      source: "seed",
      url,
      confidence: "low",
      metadata: { configured: true },
    }));
  },
};

export const firecrawlSearchSourceAdapter: LeadSourceAdapter = {
  id: "firecrawl_search",
  async discover(input) {
    const candidates = await discoverFirecrawlSearchCandidates(input.env);
    return candidates.map((candidate): RawLeadCandidate => ({
      source: "firecrawl_search",
      url: candidate.url,
      query: candidate.query,
      title: candidate.title,
      confidence: "medium",
    }));
  },
};

export const googleSearchSourceAdapter: LeadSourceAdapter = {
  id: "google_search",
  async discover(input) {
    if (!input.env.GOOGLE_SEARCH_API_KEY || !input.env.GOOGLE_SEARCH_CX) {
      throw missingConfig("GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_CX is not set");
    }
    const candidates: RawLeadCandidate[] = [];
    for (const query of input.queries) {
      const searchQuery = input.location ? `${query} ${input.location}` : query;
      const url = new URL("https://www.googleapis.com/customsearch/v1");
      url.searchParams.set("key", input.env.GOOGLE_SEARCH_API_KEY);
      url.searchParams.set("cx", input.env.GOOGLE_SEARCH_CX);
      url.searchParams.set("q", searchQuery);
      url.searchParams.set("num", String(Math.min(input.limit, 10)));
      url.searchParams.set("hl", input.lang);
      url.searchParams.set("gl", input.country);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`google_search_${response.status}`);
      const payload = await response.json() as { items?: Array<{ link?: string; title?: string; snippet?: string }> };
      for (const item of payload.items ?? []) {
        if (!item.link) continue;
        candidates.push({
          source: "google_search",
          url: item.link,
          query: searchQuery,
          title: item.title,
          snippet: item.snippet,
          confidence: "medium",
        });
      }
    }
    return candidates;
  },
};

export const portalSearchSourceAdapter: LeadSourceAdapter = {
  id: "portal_search",
  async discover(input) {
    return discoverPortalSearchCandidates(input);
  },
};

export const googleMapsSourceAdapter: LeadSourceAdapter = {
  id: "google_maps",
  async discover(input) {
    if (!input.env.GOOGLE_MAPS_API_KEY) throw missingConfig("GOOGLE_MAPS_API_KEY is not set");
    const candidates: RawLeadCandidate[] = [];
    for (const query of input.queries) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      url.searchParams.set("key", input.env.GOOGLE_MAPS_API_KEY);
      url.searchParams.set("query", input.location ? `${query} ${input.location}` : query);
      url.searchParams.set("language", input.lang);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`google_maps_${response.status}`);
      const payload = await response.json() as {
        status?: string;
        results?: Array<{
          place_id?: string;
          name?: string;
          formatted_address?: string;
          types?: string[];
          website?: string;
          formatted_phone_number?: string;
          url?: string;
          business_status?: string;
        }>;
      };
      assertGoogleMapsStatus(payload.status, "google_maps");
      for (const place of (payload.results ?? []).slice(0, input.limit)) {
        const details = place.place_id ? await fetchGooglePlaceDetails(input, place.place_id) : null;
        const hydratedPlace = { ...place, ...details, types: details?.types ?? place.types };
        const mapsProfile = hydratedPlace.url ?? (hydratedPlace.place_id ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(hydratedPlace.place_id)}` : undefined);
        candidates.push({
          source: "google_maps",
          url: hydratedPlace.website ?? mapsProfile,
          businessName: hydratedPlace.name,
          category: hydratedPlace.types?.[0],
          location: hydratedPlace.formatted_address,
          sourceBusinessId: hydratedPlace.place_id,
          confidence: "high",
          contactHints: [
            ...(hydratedPlace.formatted_phone_number ? [{ type: "phone" as const, value: hydratedPlace.formatted_phone_number, sourceUrl: mapsProfile, confidence: "medium" as const, label: "Google Maps phone" }] : []),
            ...(mapsProfile ? [{ type: "maps_profile" as const, value: mapsProfile, sourceUrl: mapsProfile, confidence: "high" as const, label: "Google Maps profile" }] : []),
          ],
          metadata: { query, types: hydratedPlace.types, businessStatus: hydratedPlace.business_status, detailsHydrated: Boolean(details) },
        });
      }
    }
    return candidates;
  },
};

export const apolloOrganizationSourceAdapter: LeadSourceAdapter = {
  id: "apollo_organization",
  async discover(input) {
    if (!input.env.APOLLO_API_KEY) throw missingConfig("APOLLO_API_KEY is not set");

    const employeeRanges = readApolloEmployeeRanges(input.env.APOLLO_ORGANIZATION_EMPLOYEE_RANGES);
    const locations = readList(input.env.APOLLO_ORGANIZATION_LOCATIONS);
    const fallbackLocations = locations.length > 0 ? locations : [input.location || countryToApolloLocation(input.country)].filter(Boolean);
    const maxEmployees = readPositiveInteger(input.env.APOLLO_ORGANIZATION_MAX_EMPLOYEES, 1000);
    const candidates: RawLeadCandidate[] = [];

    for (const query of input.queries) {
      const url = new URL(input.env.APOLLO_ORGANIZATION_SEARCH_API_BASE_URL ?? "https://api.apollo.io/api/v1/mixed_companies/search");
      appendSearchParams(url, "q_organization_keyword_tags[]", mapApolloKeywordTags(query));
      appendSearchParams(url, "organization_num_employees_ranges[]", employeeRanges.length > 0 ? employeeRanges : ["11,50", "51,200", "201,500", "501,1000"]);
      appendSearchParams(url, "organization_locations[]", fallbackLocations);
      url.searchParams.set("page", "1");
      url.searchParams.set("per_page", String(Math.min(input.limit, 100)));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${input.env.APOLLO_API_KEY}`,
          "x-api-key": input.env.APOLLO_API_KEY,
        },
      });
      if (!response.ok) throw new Error(`apollo_organization_${response.status}`);
      const payload = await response.json() as unknown;
      for (const organization of extractApolloOrganizations(payload)) {
        const employeeCount = readNumber(organization.estimated_num_employees ?? organization.num_employees ?? organization.employee_count);
        if (employeeCount !== undefined && employeeCount > maxEmployees) continue;
        const website = readString(organization.website_url ?? organization.website ?? organization.organization_website_url);
        const domain = normalizeLookupDomain(readString(organization.primary_domain ?? organization.domain ?? organization.organization_domain) ?? website ?? "");
        const urlValue = website ?? (domain ? `https://${domain}/` : undefined);
        if (!urlValue && !domain) continue;
        const location = formatApolloLocation(organization);

        candidates.push({
          source: "apollo_organization",
          url: urlValue,
          domain: domain || undefined,
          query,
          businessName: readString(organization.name ?? organization.organization_name),
          category: readString(organization.industry ?? organization.primary_industry ?? organization.category),
          location,
          sourceBusinessId: readString(organization.id ?? organization.organization_id),
          confidence: employeeCount === undefined || employeeCount <= maxEmployees ? "high" : "medium",
          metadata: {
            provider: "apollo",
            lookupMode: "organization_search",
            employees: employeeCount,
            linkedinUrl: readString(organization.linkedin_url),
          },
        });
        if (candidates.length >= input.limit) return candidates;
      }
    }

    return candidates;
  },
};

export const technologyIntelligenceSourceAdapter: LeadSourceAdapter = {
  id: "technology_intelligence",
  async discover(input) {
    const configuredDomains = uniqueList(readList(input.env.REVENUE_AGENT_TECH_DISCOVERY_DOMAINS).map(normalizeLookupDomain).filter(Boolean));
    const configuredTechnologies = readList(input.env.REVENUE_AGENT_TECH_DISCOVERY_TECHNOLOGIES);
    const provider = selectTechnologyProvider(input.env);
    if (configuredDomains.length === 0 && configuredTechnologies.length === 0) {
      throw missingConfig("technology intelligence provider is not configured");
    }
    if (!provider && configuredDomains.length === 0) {
      throw missingConfig("BUILTWITH_API_KEY is required for technology list discovery");
    }
    if (provider === "wappalyzer" && configuredDomains.length === 0) {
      throw missingConfig("REVENUE_AGENT_TECH_DISCOVERY_DOMAINS is required for Wappalyzer lookup");
    }

    const candidates: RawLeadCandidate[] = [];
    for (const domain of configuredDomains.slice(0, input.limit)) {
      if (provider === "builtwith") {
        candidates.push(await fetchBuiltWithDomainCandidate(input, domain, configuredTechnologies));
      } else if (provider === "wappalyzer") {
        candidates.push(await fetchWappalyzerDomainCandidate(input, domain, configuredTechnologies));
      } else {
        candidates.push({
          source: "technology_intelligence",
          domain,
          technologies: configuredTechnologies,
          confidence: "high",
          metadata: { provider: "configured_domains", lookupMode: "configured_domain" },
        });
      }
    }

    if (provider === "builtwith" && configuredTechnologies.length > 0 && candidates.length < input.limit) {
      for (const technology of configuredTechnologies) {
        const remaining = input.limit - candidates.length;
        if (remaining <= 0) break;
        candidates.push(...await fetchBuiltWithTechnologyListCandidates(input, technology, remaining));
      }
    }

    return candidates.slice(0, input.limit);
  },
};

export function readEnabledSources(value: string | undefined): LeadSourceId[] {
  const configured = readList(value) as LeadSourceId[];
  const valid = configured.filter((source): source is LeadSourceId => DEFAULT_DISCOVERY_SOURCES.includes(source));
  return valid.length > 0 ? valid : DEFAULT_PRIMARY_DISCOVERY_SOURCES;
}

function readList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readApolloEmployeeRanges(value: string | undefined): string[] {
  if (!value) return [];
  return uniqueList([...value.matchAll(/\b(\d{1,6})\s*,\s*(\d{1,6})\b/g)].flatMap((match) => {
    const min = Number(match[1]);
    const max = Number(match[2]);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || max < min) return [];
    return [`${min},${max}`];
  }));
}

function appendSearchParams(url: URL, key: string, values: string[]): void {
  for (const value of uniqueList(values)) url.searchParams.append(key, value);
}

function countryToApolloLocation(country: string): string {
  const normalized = country.trim().toLowerCase();
  if (normalized === "jp" || normalized === "jpn" || normalized === "ja") return "Japan";
  if (normalized === "us" || normalized === "usa") return "United States";
  return country;
}

const APOLLO_INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "美容室": ["beauty salon", "consumer services"],
  "整体": ["health wellness fitness", "alternative medicine"],
  "歯科": ["dentist", "medical practice"],
  "税理士": ["accounting"],
  "弁護士": ["law practice", "legal services"],
  "工務店": ["construction"],
  "不動産": ["real estate"],
  "パーソナルジム": ["health wellness fitness"],
  "士業": ["legal services", "accounting"],
  "クリニック": ["medical practice", "hospital health care"],
  "学習塾": ["education management", "e-learning"],
  "探偵": ["security and investigations"],
  "外壁塗装": ["construction", "painting"],
  "リフォーム": ["construction", "home improvement"],
  "エステ": ["beauty", "cosmetics", "health wellness fitness"],
  "Web予約系店舗": ["consumer services", "hospitality", "restaurants"],
};

function mapApolloKeywordTags(query: string): string[] {
  const mapped = Object.entries(APOLLO_INDUSTRY_KEYWORDS).flatMap(([industry, keywords]) => (
    query.includes(industry) ? keywords : []
  ));
  if (mapped.length > 0) return uniqueList(mapped);
  const cleaned = query.replace(/公式サイト|地域密着|中小企業/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? [cleaned] : [];
}

function extractApolloOrganizations(payload: unknown): Record<string, unknown>[] {
  if (!isRecord(payload)) return [];
  const organizations = payload.organizations ?? payload.accounts ?? payload.companies;
  if (!Array.isArray(organizations)) return [];
  return organizations.filter(isRecord);
}

function formatApolloLocation(organization: Record<string, unknown>): string | undefined {
  const primaryLocation = organization.primary_location;
  if (isRecord(primaryLocation)) {
    const location = [
      primaryLocation.city,
      primaryLocation.state,
      primaryLocation.country,
    ].filter((value): value is string => typeof value === "string" && value.length > 0).join(", ");
    if (location) return location;
  }

  return [
    organization.city,
    organization.state,
    organization.country,
  ].filter((value): value is string => typeof value === "string" && value.length > 0).join(", ") || undefined;
}

type GooglePlaceDetails = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  types?: string[];
  website?: string;
  formatted_phone_number?: string;
  url?: string;
  business_status?: string;
};

async function fetchGooglePlaceDetails(input: LeadSourceInput, placeId: string): Promise<GooglePlaceDetails | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("key", input.env.GOOGLE_MAPS_API_KEY ?? "");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("language", input.lang);
  url.searchParams.set("fields", "place_id,name,formatted_address,types,website,formatted_phone_number,url,business_status");
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = await response.json() as { status?: string; result?: GooglePlaceDetails };
    assertGoogleMapsStatus(payload.status, "google_maps_details");
    return payload.result ?? null;
  } catch {
    return null;
  }
}

function assertGoogleMapsStatus(status: string | undefined, label: string): void {
  if (!status || status === "OK" || status === "ZERO_RESULTS") return;
  throw new Error(`${label}_${status.toLowerCase()}`);
}

type TechnologyProvider = "builtwith" | "wappalyzer";

function selectTechnologyProvider(env: NodeJS.ProcessEnv): TechnologyProvider | null {
  if (env.BUILTWITH_API_KEY) return "builtwith";
  if (env.WAPPALYZER_API_KEY) return "wappalyzer";
  return null;
}

async function fetchBuiltWithDomainCandidate(input: LeadSourceInput, domain: string, configuredTechnologies: string[]): Promise<RawLeadCandidate> {
  const url = new URL(input.env.BUILTWITH_API_BASE_URL ?? "https://api.builtwith.com/v22/api.json");
  url.searchParams.set("KEY", input.env.BUILTWITH_API_KEY ?? "");
  url.searchParams.set("LOOKUP", domain);
  url.searchParams.set("HIDETEXT", "yes");
  url.searchParams.set("NOMETA", "yes");
  url.searchParams.set("NOPII", "yes");
  url.searchParams.set("NOATTR", "yes");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`builtwith_${response.status}`);
  const payload = await response.json() as unknown;
  return {
    source: "technology_intelligence",
    domain,
    technologies: uniqueList([...configuredTechnologies, ...extractBuiltWithTechnologies(payload)]),
    confidence: "high",
    metadata: { provider: "builtwith", lookupMode: "domain_lookup" },
  };
}

async function fetchBuiltWithTechnologyListCandidates(input: LeadSourceInput, technology: string, limit: number): Promise<RawLeadCandidate[]> {
  const url = new URL(input.env.BUILTWITH_LISTS_API_BASE_URL ?? "https://api.builtwith.com/lists12/api.json");
  url.searchParams.set("KEY", input.env.BUILTWITH_API_KEY ?? "");
  url.searchParams.set("TECH", technology.replace(/\s+/g, "-"));
  if (/^[a-z]{2}$/i.test(input.country)) url.searchParams.set("COUNTRY", input.country.toUpperCase());
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`builtwith_list_${response.status}`);
  const payload = await response.json() as unknown;
  return extractBuiltWithListResults(payload).slice(0, limit).map((result): RawLeadCandidate => ({
    source: "technology_intelligence",
    domain: result.domain,
    businessName: result.companyName,
    location: result.location,
    technologies: [technology],
    confidence: "medium",
    metadata: { provider: "builtwith", lookupMode: "technology_list", technology },
  }));
}

async function fetchWappalyzerDomainCandidate(input: LeadSourceInput, domain: string, configuredTechnologies: string[]): Promise<RawLeadCandidate> {
  const url = new URL(input.env.WAPPALYZER_API_BASE_URL ?? "https://api.wappalyzer.com/v2/lookup/");
  url.searchParams.set("urls", `https://${domain}`);
  url.searchParams.set("recursive", "false");
  if (input.env.WAPPALYZER_LIVE_LOOKUP === "true") url.searchParams.set("live", "true");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-api-key": input.env.WAPPALYZER_API_KEY ?? "",
    },
  });
  if (!response.ok) throw new Error(`wappalyzer_${response.status}`);
  const payload = await response.json() as unknown;
  return {
    source: "technology_intelligence",
    domain,
    technologies: uniqueList([...configuredTechnologies, ...extractWappalyzerTechnologies(payload)]),
    confidence: "high",
    metadata: { provider: "wappalyzer", lookupMode: "domain_lookup", live: input.env.WAPPALYZER_LIVE_LOOKUP === "true" },
  };
}

function extractBuiltWithTechnologies(payload: unknown): string[] {
  const names: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "Technologies" && Array.isArray(item)) {
        for (const technology of item) {
          if (isRecord(technology) && typeof technology.Name === "string") names.push(technology.Name);
        }
        continue;
      }
      visit(item);
    }
  };
  visit(payload);
  return uniqueList(names);
}

function extractBuiltWithListResults(payload: unknown): Array<{ domain: string; companyName?: string; location?: string }> {
  if (!isRecord(payload) || !Array.isArray(payload.Results)) return [];
  return payload.Results.flatMap((item) => {
    if (!isRecord(item) || typeof item.D !== "string") return [];
    const meta = isRecord(item.META) ? item.META : {};
    const location = [meta.City, meta.State, meta.Country].filter((value): value is string => typeof value === "string" && value.length > 0).join(", ");
    return [{
      domain: normalizeLookupDomain(item.D),
      companyName: typeof meta.CompanyName === "string" ? meta.CompanyName : undefined,
      location: location || undefined,
    }];
  }).filter((item) => item.domain.length > 0);
}

function extractWappalyzerTechnologies(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return uniqueList(payload.flatMap((entry) => {
    if (!isRecord(entry) || !Array.isArray(entry.technologies)) return [];
    return entry.technologies.flatMap((technology) => (
      isRecord(technology) && typeof technology.name === "string" ? [technology.name] : []
    ));
  }));
}

function normalizeLookupDomain(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0]?.replace(/^www\./, "") ?? "";
  }
}

function uniqueList(values: string[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const cleaned = value.trim();
    if (!cleaned) return [];
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [cleaned];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function missingConfig(message: string): Error {
  const err = new Error(message);
  err.name = "MissingLeadSourceConfigError";
  return err;
}

function isMissingConfigError(err: unknown): boolean {
  return err instanceof Error && err.name === "MissingLeadSourceConfigError";
}
