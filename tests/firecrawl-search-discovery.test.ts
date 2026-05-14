import { describe, expect, it, vi } from "vitest";

vi.mock("firecrawl", () => ({
  default: class MockFirecrawlApp {
    search = vi.fn(async (query: string) => ({
      success: true,
      data: [
        { url: `https://${query.replace(/\s+/g, "-")}.example/`, metadata: { title: `${query} result` } },
        { metadata: { sourceURL: "https://source-url.example/", title: "Source URL result" } },
      ],
    }));
  },
}));

describe("discoverFirecrawlSearchCandidates", () => {
  it("returns candidates from Firecrawl search results", async () => {
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

  it("does not call Firecrawl without queries or an API key", async () => {
    const { discoverFirecrawlSearchCandidates } = await import("../src/discovery/firecrawl-search.js");

    await expect(discoverFirecrawlSearchCandidates({} as NodeJS.ProcessEnv)).resolves.toEqual([]);
    await expect(
      discoverFirecrawlSearchCandidates({ REVENUE_AGENT_DISCOVERY_QUERIES: "tax accountant tokyo" } as NodeJS.ProcessEnv),
    ).resolves.toEqual([]);
  });
});
