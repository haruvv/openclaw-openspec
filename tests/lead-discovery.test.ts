import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apolloOrganizationSourceAdapter, executeLeadSourceAdapters, googleMapsSourceAdapter, readEnabledSources, technologyIntelligenceSourceAdapter } from "../src/discovery/adapters.js";
import { chooseLeadRoute, normalizeContactMethods } from "../src/discovery/contact-routing.js";
import { mergeSiteCandidates, normalizeRawLeadCandidate } from "../src/discovery/normalization.js";
import { scoreLeadPriority } from "../src/discovery/priority.js";
import { getLeadDiscoveryDb, upsertLeadCandidate } from "../src/discovery/repository.js";
import { resetDb } from "../src/utils/db.js";

describe("lead discovery domain", () => {
  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), "lead-discovery-"));
    process.env.DB_PATH = join(dir, "pipeline.db");
    resetDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes raw source candidates and merges strong duplicate identities", () => {
    const search = normalizeRawLeadCandidate({
      source: "google_search",
      url: "https://www.example.com/?utm_source=test",
      query: "整体院 公式サイト",
      title: "Example",
      metadata: { apiKey: "secret", visible: "ok" },
    });
    const maps = normalizeRawLeadCandidate({
      source: "google_maps",
      url: "https://example.com/",
      businessName: "Example",
      category: "clinic",
      location: "Tokyo",
      sourceBusinessId: "place-1",
      contactHints: [{ type: "phone", value: "03-0000-0000" }],
    });

    expect(search).not.toBeNull();
    expect(maps).not.toBeNull();
    const merged = mergeSiteCandidates([search!, maps!]);

    expect(merged).toHaveLength(1);
    expect(merged[0].sourceProvenance.map((source) => source.source)).toEqual(["google_search", "google_maps"]);
    expect(merged[0].contactHints[0]).toMatchObject({ type: "phone", value: "03-0000-0000" });
    expect(merged[0].metadata).not.toHaveProperty("apiKey");
  });

  it("keeps weak name-only matches separate", () => {
    const a = normalizeRawLeadCandidate({ source: "google_maps", url: "https://a.example/", businessName: "Same Name", category: "clinic", location: "Tokyo" });
    const b = normalizeRawLeadCandidate({ source: "google_maps", url: "https://b.example/", businessName: "Same Name", category: "restaurant", location: "Osaka" });

    expect(mergeSiteCandidates([a!, b!])).toHaveLength(2);
  });

  it("isolates source adapter failures", async () => {
    const results = await executeLeadSourceAdapters([
      { id: "seed", discover: async () => [{ source: "seed", url: "https://ok.example/" }] },
      { id: "google_maps", discover: async () => { throw new Error("provider_failed"); } },
    ], {
      queries: [],
      seedUrls: [],
      limit: 10,
      country: "jp",
      lang: "ja",
      location: "",
      env: {} as NodeJS.ProcessEnv,
    });

    expect(results.map((result) => result.report.status)).toEqual(["passed", "failed"]);
    expect(results[0].candidates).toHaveLength(1);
  });

  it("reports missing provider configuration as a skipped source", async () => {
    const results = await executeLeadSourceAdapters([googleMapsSourceAdapter], {
      queries: ["clinic tokyo"],
      seedUrls: [],
      limit: 10,
      country: "jp",
      lang: "ja",
      location: "Tokyo",
      env: {} as NodeJS.ProcessEnv,
    });

    expect(results[0].report).toMatchObject({
      source: "google_maps",
      status: "skipped",
      candidateCount: 0,
    });
  });

  it("does not use Apollo organization search as a default primary discovery source", () => {
    expect(readEnabledSources(undefined)).toEqual(["seed", "firecrawl_search", "google_maps"]);
  });

  it("hydrates Google Maps candidates with Place Details", async () => {
    const fetchMock = vi.fn(async (url: URL | string) => {
      const href = String(url);
      if (href.includes("/textsearch/")) {
        return new Response(JSON.stringify({
          status: "OK",
          results: [{
            place_id: "place-1",
            name: "Search Name",
            formatted_address: "Tokyo",
            types: ["restaurant"],
          }],
        }));
      }
      if (href.includes("/details/")) {
        return new Response(JSON.stringify({
          status: "OK",
          result: {
            place_id: "place-1",
            name: "Detail Name",
            formatted_address: "Shibuya, Tokyo",
            types: ["cafe"],
            website: "https://detail.example/",
            formatted_phone_number: "03-0000-0000",
            url: "https://maps.google.com/?cid=1",
            business_status: "OPERATIONAL",
          },
        }));
      }
      throw new Error(`unexpected_url:${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const candidates = await googleMapsSourceAdapter.discover({
      queries: ["cafe"],
      seedUrls: [],
      limit: 5,
      country: "jp",
      lang: "ja",
      location: "Tokyo",
      env: { GOOGLE_MAPS_API_KEY: "maps-key" } as NodeJS.ProcessEnv,
    }, { now: new Date("2026-06-06T00:00:00Z") });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const detailsUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(detailsUrl.searchParams.get("fields")).toContain("website");
    expect(candidates[0]).toMatchObject({
      source: "google_maps",
      url: "https://detail.example/",
      businessName: "Detail Name",
      category: "cafe",
      location: "Shibuya, Tokyo",
      metadata: { businessStatus: "OPERATIONAL", detailsHydrated: true },
    });
    expect(candidates[0].contactHints).toEqual([
      { type: "phone", value: "03-0000-0000", sourceUrl: "https://maps.google.com/?cid=1", confidence: "medium", label: "Google Maps phone" },
      { type: "maps_profile", value: "https://maps.google.com/?cid=1", sourceUrl: "https://maps.google.com/?cid=1", confidence: "high", label: "Google Maps profile" },
    ]);
  });

  it("falls back to the Maps profile when Place Details cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL | string) => {
      const href = String(url);
      if (href.includes("/textsearch/")) {
        return new Response(JSON.stringify({
          status: "OK",
          results: [{ place_id: "place-2", name: "Fallback Shop", formatted_address: "Tokyo", types: ["store"] }],
        }));
      }
      return new Response("provider unavailable", { status: 503 });
    }));

    const candidates = await googleMapsSourceAdapter.discover({
      queries: ["store"],
      seedUrls: [],
      limit: 5,
      country: "jp",
      lang: "ja",
      location: "Tokyo",
      env: { GOOGLE_MAPS_API_KEY: "maps-key" } as NodeJS.ProcessEnv,
    }, { now: new Date("2026-06-06T00:00:00Z") });

    expect(candidates[0]).toMatchObject({
      url: "https://www.google.com/maps/place/?q=place_id:place-2",
      businessName: "Fallback Shop",
      metadata: { detailsHydrated: false },
    });
  });

  it("discovers SMB organization candidates with Apollo", async () => {
    const fetchMock = vi.fn(async (url: URL | string, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      expect(String(requestUrl.origin + requestUrl.pathname)).toBe("https://apollo.test/api/v1/mixed_companies/search");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer apollo-key",
        "x-api-key": "apollo-key",
      });
      expect(requestUrl.searchParams.getAll("q_organization_keyword_tags[]")).toContain("beauty salon");
      expect(requestUrl.searchParams.getAll("organization_num_employees_ranges[]")).toEqual(["11,50", "51,200", "201,500", "501,1000"]);
      expect(requestUrl.searchParams.getAll("organization_locations[]")).toEqual(["Japan"]);
      return new Response(JSON.stringify({
        organizations: [
          {
            id: "org-1",
            name: "Local Salon",
            website_url: "https://salon.example/",
            industry: "Consumer Services",
            estimated_num_employees: 650,
            city: "Tokyo",
            country: "Japan",
            linkedin_url: "https://linkedin.com/company/local-salon",
          },
          {
            id: "org-big",
            name: "Big Chain",
            website_url: "https://big.example/",
            industry: "Consumer Services",
            estimated_num_employees: 1200,
          },
        ],
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const candidates = await apolloOrganizationSourceAdapter.discover({
      queries: ["美容室 公式サイト"],
      seedUrls: [],
      limit: 10,
      country: "jp",
      lang: "ja",
      location: "",
      env: {
        APOLLO_API_KEY: "apollo-key",
        APOLLO_ORGANIZATION_SEARCH_API_BASE_URL: "https://apollo.test/api/v1/mixed_companies/search",
        APOLLO_ORGANIZATION_MAX_EMPLOYEES: "1000",
      } as NodeJS.ProcessEnv,
    }, { now: new Date("2026-06-06T00:00:00Z") });

    expect(candidates).toEqual([{
      source: "apollo_organization",
      url: "https://salon.example/",
      domain: "salon.example",
      query: "美容室 公式サイト",
      businessName: "Local Salon",
      category: "Consumer Services",
      location: "Tokyo, Japan",
      sourceBusinessId: "org-1",
      confidence: "high",
      metadata: {
        provider: "apollo",
        lookupMode: "organization_search",
        employees: 650,
        linkedinUrl: "https://linkedin.com/company/local-salon",
      },
    }]);
  });

  it("discovers BuiltWith technology-list candidates", async () => {
    const fetchMock = vi.fn(async (url: URL | string) => {
      const requestUrl = new URL(String(url));
      expect(requestUrl.searchParams.get("TECH")).toBe("Shopify");
      expect(requestUrl.searchParams.get("COUNTRY")).toBe("JP");
      return new Response(JSON.stringify({
        Results: [
          { D: "shop.example", META: { CompanyName: "Shop Example", City: "Tokyo", Country: "JP" } },
          { D: "www.other.example" },
        ],
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const candidates = await technologyIntelligenceSourceAdapter.discover({
      queries: [],
      seedUrls: [],
      limit: 2,
      country: "jp",
      lang: "ja",
      location: "Tokyo",
      env: {
        BUILTWITH_API_KEY: "builtwith-key",
        BUILTWITH_LISTS_API_BASE_URL: "https://builtwith.test/lists.json",
        REVENUE_AGENT_TECH_DISCOVERY_TECHNOLOGIES: "Shopify",
      } as NodeJS.ProcessEnv,
    }, { now: new Date("2026-06-06T00:00:00Z") });

    expect(candidates).toEqual([
      {
        source: "technology_intelligence",
        domain: "shop.example",
        businessName: "Shop Example",
        location: "Tokyo, JP",
        technologies: ["Shopify"],
        confidence: "medium",
        metadata: { provider: "builtwith", lookupMode: "technology_list", technology: "Shopify" },
      },
      {
        source: "technology_intelligence",
        domain: "other.example",
        businessName: undefined,
        location: undefined,
        technologies: ["Shopify"],
        confidence: "medium",
        metadata: { provider: "builtwith", lookupMode: "technology_list", technology: "Shopify" },
      },
    ]);
  });

  it("enriches configured domains with BuiltWith technologies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      Result: {
        Paths: [{
          Technologies: [{ Name: "WordPress" }, { Name: "Google Analytics" }],
        }],
      },
    }))));

    const candidates = await technologyIntelligenceSourceAdapter.discover({
      queries: [],
      seedUrls: [],
      limit: 10,
      country: "jp",
      lang: "ja",
      location: "",
      env: {
        BUILTWITH_API_KEY: "builtwith-key",
        BUILTWITH_API_BASE_URL: "https://builtwith.test/domain.json",
        REVENUE_AGENT_TECH_DISCOVERY_DOMAINS: "https://www.example.com/path",
      } as NodeJS.ProcessEnv,
    }, { now: new Date("2026-06-06T00:00:00Z") });

    expect(candidates[0]).toMatchObject({
      domain: "example.com",
      technologies: ["WordPress", "Google Analytics"],
      metadata: { provider: "builtwith", lookupMode: "domain_lookup" },
    });
  });

  it("enriches configured domains with Wappalyzer technologies", async () => {
    const fetchMock = vi.fn(async (url: URL | string, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      expect(requestUrl.searchParams.get("urls")).toBe("https://example.com");
      expect(init?.headers).toMatchObject({ "x-api-key": "wappalyzer-key" });
      return new Response(JSON.stringify([
        {
          url: "https://example.com",
          technologies: [{ name: "Next.js" }, { name: "Stripe" }],
        },
      ]));
    });
    vi.stubGlobal("fetch", fetchMock);

    const candidates = await technologyIntelligenceSourceAdapter.discover({
      queries: [],
      seedUrls: [],
      limit: 10,
      country: "jp",
      lang: "ja",
      location: "",
      env: {
        WAPPALYZER_API_KEY: "wappalyzer-key",
        WAPPALYZER_API_BASE_URL: "https://wappalyzer.test/lookup/",
        REVENUE_AGENT_TECH_DISCOVERY_DOMAINS: "example.com",
      } as NodeJS.ProcessEnv,
    }, { now: new Date("2026-06-06T00:00:00Z") });

    expect(candidates[0]).toMatchObject({
      domain: "example.com",
      technologies: ["Next.js", "Stripe"],
      metadata: { provider: "wappalyzer", lookupMode: "domain_lookup", live: false },
    });
  });


  it("persists candidates while sanitizing provider metadata", async () => {
    const candidate = normalizeRawLeadCandidate({
      source: "technology_intelligence",
      domain: "example.com",
      technologies: ["WordPress"],
      metadata: { token: "secret", provider: "wappalyzer" },
    });

    await upsertLeadCandidate(candidate!);
    const db = await getLeadDiscoveryDb();
    const row = db.prepare("SELECT metadata_json FROM lead_candidates WHERE domain = ?").get("example.com") as { metadata_json: string };
    const metadata = JSON.parse(row.metadata_json) as Record<string, unknown>;

    expect(metadata).toEqual({ provider: "wappalyzer" });
  });

  it("scores and routes leads deterministically", () => {
    const methods = normalizeContactMethods({
      fallbackUrl: "https://example.com/",
      hints: [{ type: "form", value: "https://example.com/contact", confidence: "high" }],
    });
    const score = scoreLeadPriority({ seoScore: 28, contactMethods: methods, manualCapacityAvailable: true });
    const route = chooseLeadRoute({ contactMethods: methods, priorityScore: score });

    expect(score.label).toBe("high");
    expect(route).toMatchObject({ route: "queue_contact_form", status: "queued" });
  });
});
