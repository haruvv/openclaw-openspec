import { describe, expect, it, vi } from "vitest";

const searchMock = vi.fn(async (query: string) => ({
  success: true,
  data: [
    { url: `https://${query.replace(/\s+/g, "-")}.example/`, metadata: { title: `${query} result` } },
    { metadata: { sourceURL: "https://source-url.example/", title: "Source URL result" } },
  ],
}));

vi.mock("firecrawl", () => ({
  default: class MockFirecrawlApp {
    search = searchMock;
  },
}));

describe("discoverFirecrawlSearchCandidates", () => {
  it("returns candidates from Firecrawl search results", async () => {
    searchMock.mockClear();
    const { discoverFirecrawlSearchCandidates } = await import("../src/discovery/firecrawl-search.js");

    const candidates = await discoverFirecrawlSearchCandidates({
      FIRECRAWL_API_KEY: "firecrawl-test",
      REVENUE_AGENT_DISCOVERY_QUERIES: "tax accountant tokyo",
    } as NodeJS.ProcessEnv);

    expect(candidates).toEqual([
      {
        url: "https://tax-accountant-tokyo.example/",
        source: "firecrawl_search",
        query: "tax accountant tokyo",
        title: "tax accountant tokyo result",
      },
      {
        url: "https://source-url.example/",
        source: "firecrawl_search",
        query: "tax accountant tokyo",
        title: "Source URL result",
      },
    ]);
  });

  it("passes configured search locale to Firecrawl", async () => {
    searchMock.mockClear();
    const { discoverFirecrawlSearchCandidates } = await import("../src/discovery/firecrawl-search.js");

    await discoverFirecrawlSearchCandidates({
      FIRECRAWL_API_KEY: "firecrawl-test",
      REVENUE_AGENT_DISCOVERY_QUERIES: "税理士 公式サイト",
      REVENUE_AGENT_DISCOVERY_SEARCH_LIMIT: "8",
      REVENUE_AGENT_DISCOVERY_SEARCH_COUNTRY: "jp",
      REVENUE_AGENT_DISCOVERY_SEARCH_LANG: "ja",
      REVENUE_AGENT_DISCOVERY_SEARCH_LOCATION: "Tokyo",
    } as NodeJS.ProcessEnv);

    expect(searchMock).toHaveBeenCalledWith("税理士 公式サイト", {
      limit: 8,
      country: "jp",
      lang: "ja",
      location: "Tokyo",
      scrapeOptions: { formats: [] },
    });
  });

  it("does not call Firecrawl without queries or an API key", async () => {
    searchMock.mockClear();
    const { discoverFirecrawlSearchCandidates } = await import("../src/discovery/firecrawl-search.js");

    await expect(discoverFirecrawlSearchCandidates({} as NodeJS.ProcessEnv)).resolves.toEqual([]);
    await expect(
      discoverFirecrawlSearchCandidates({ REVENUE_AGENT_DISCOVERY_QUERIES: "tax accountant tokyo" } as NodeJS.ProcessEnv),
    ).resolves.toEqual([]);
    expect(searchMock).not.toHaveBeenCalled();
  });
});
