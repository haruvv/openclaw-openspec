import { describe, expect, it, vi } from "vitest";
import { runDailyDiscoveryJob } from "../src/discovery/job.js";

describe("runDailyDiscoveryJob", () => {
  it("does nothing when discovery is disabled", async () => {
    const runAgent = vi.fn();

    const report = await runDailyDiscoveryJob({
      env: {
        REVENUE_AGENT_DISCOVERY_ENABLED: "false",
        REVENUE_AGENT_DISCOVERY_SEED_URLS: "https://example.com",
      } as NodeJS.ProcessEnv,
      runAgent,
    });

    expect(report).toMatchObject({ status: "disabled", selectedCount: 0 });
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("skips already analyzed URLs and respects the daily quota", async () => {
    const runAgent = vi
      .fn()
      .mockResolvedValueOnce(buildRunReport("run-1", "https://new-one.com/"))
      .mockResolvedValueOnce(buildRunReport("run-2", "https://new-two.com/"));

    const report = await runDailyDiscoveryJob({
      env: {
        REVENUE_AGENT_DISCOVERY_ENABLED: "true",
        REVENUE_AGENT_DISCOVERY_DAILY_QUOTA: "2",
        REVENUE_AGENT_DISCOVERY_SEED_URLS: [
          "https://already.com/",
          "https://new-one.com/",
          "https://new-two.com/",
          "https://new-three.com/",
        ].join(","),
      } as NodeJS.ProcessEnv,
      discoverCandidates: async () => [],
      listExistingSites: async () => [
        {
          id: "site-1",
          normalizedUrl: "https://already.com/",
          displayUrl: "https://already.com/",
          domain: "already.com",
          latestStatus: "passed",
          snapshotCount: 1,
          createdAt: "2026-05-14T00:00:00.000Z",
          updatedAt: "2026-05-14T00:00:00.000Z",
        },
      ],
      validateUrl: async (url) => ({ ok: true, url }),
      checkContactEmail: async () => ({ ok: true, contactEmail: "info@example.com" }),
      requireContactEmail: true,
      runAgent,
    });

    expect(report.status).toBe("passed");
    expect(report.selectedCount).toBe(2);
    expect(report.skipped).toContainEqual({ url: "https://already.com/", reason: "already_analyzed" });
    expect(report.runs.map((run) => run.runId)).toEqual(["run-1", "run-2"]);
    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: "https://new-one.com/",
        source: "discovery",
        sendEmail: false,
        sendTelegram: false,
        createPaymentLink: false,
      }),
    );
    expect(runAgent).not.toHaveBeenCalledWith(expect.objectContaining({ targetUrl: "https://new-three.com/" }));
  });

  it("merges search candidates with seed URLs", async () => {
    const runAgent = vi
      .fn()
      .mockResolvedValueOnce(buildRunReport("run-1", "https://seed.com/"))
      .mockResolvedValueOnce(buildRunReport("run-2", "https://search.com/"));

    const report = await runDailyDiscoveryJob({
      env: {
        REVENUE_AGENT_DISCOVERY_ENABLED: "true",
        REVENUE_AGENT_DISCOVERY_DAILY_QUOTA: "5",
        REVENUE_AGENT_DISCOVERY_SEED_URLS: "https://seed.com/",
      } as NodeJS.ProcessEnv,
      discoverCandidates: async () => [
        { url: "https://seed.com/", source: "firecrawl_search", query: "duplicate" },
        { url: "https://search.com/", source: "firecrawl_search", query: "tax accountant tokyo", title: "Search Result" },
      ],
      listExistingSites: async () => [],
      validateUrl: async (url) => ({ ok: true, url }),
      checkContactEmail: async () => ({ ok: true, contactEmail: "info@example.com" }),
      requireContactEmail: true,
      runAgent,
    });

    expect(report.selectedCount).toBe(2);
    expect(report.runs.map((run) => run.url)).toEqual(["https://search.com/", "https://seed.com/"]);
    expect(runAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUrl: "https://search.com/",
        metadata: {
          discovery: expect.objectContaining({
            primarySource: "firecrawl_search",
            query: "tax accountant tokyo",
            title: "Search Result",
          }),
        },
      }),
    );
  });

  it("filters discovery candidates without public email before starting agent runs", async () => {
    const runAgent = vi
      .fn()
      .mockResolvedValueOnce(buildRunReport("run-1", "https://with-email.com/"))
      .mockResolvedValueOnce(buildRunReport("run-2", "https://also-email.com/"));
    const checkContactEmail = vi.fn(async (candidate: { url: string }) => {
      if (candidate.url === "https://no-email.com/") {
        return { ok: false as const, reason: "missing_contact_email" };
      }
      return { ok: true as const, contactEmail: "info@example.com" };
    });

    const report = await runDailyDiscoveryJob({
      env: {
        REVENUE_AGENT_DISCOVERY_ENABLED: "true",
        REVENUE_AGENT_DISCOVERY_DAILY_QUOTA: "2",
        REVENUE_AGENT_DISCOVERY_SEED_URLS: [
          "https://no-email.com/",
          "https://with-email.com/",
          "https://also-email.com/",
        ].join(","),
      } as NodeJS.ProcessEnv,
      discoverCandidates: async () => [],
      listExistingSites: async () => [],
      validateUrl: async (url) => ({ ok: true, url }),
      checkContactEmail,
      requireContactEmail: true,
      runAgent,
    });

    expect(report.status).toBe("passed");
    expect(report.selectedCount).toBe(2);
    expect(report.skipped).toContainEqual({ url: "https://no-email.com/", reason: "missing_contact_email" });
    expect(report.runs.map((run) => run.url)).toEqual(["https://with-email.com/", "https://also-email.com/"]);
    expect(runAgent).not.toHaveBeenCalledWith(expect.objectContaining({ targetUrl: "https://no-email.com/" }));
    expect(checkContactEmail).toHaveBeenCalledTimes(3);
  });

  it("filters likely large enterprise or chain candidates before starting agent runs", async () => {
    const runAgent = vi.fn().mockResolvedValueOnce(buildRunReport("run-1", "https://local-salon.example/"));

    const report = await runDailyDiscoveryJob({
      env: {
        REVENUE_AGENT_DISCOVERY_ENABLED: "true",
        REVENUE_AGENT_DISCOVERY_DAILY_QUOTA: "5",
      } as NodeJS.ProcessEnv,
      discoverCandidates: async () => [
        { url: "https://big-salon.example/recruit/", source: "google_search", title: "全国展開 美容室グループ 採用情報" },
        { url: "https://local-salon.example/", source: "google_search", title: "地域密着 美容室 公式サイト" },
      ],
      listExistingSites: async () => [],
      validateUrl: async (url) => ({ ok: true, url }),
      runAgent,
    });

    expect(report.selectedCount).toBe(1);
    expect(report.skipped).toContainEqual({ url: "https://big-salon.example/recruit/", reason: "large_enterprise_or_chain" });
    expect(runAgent).toHaveBeenCalledTimes(1);
    expect(runAgent).toHaveBeenCalledWith(expect.objectContaining({ targetUrl: "https://local-salon.example/" }));
  });

  it("uses Apollo as a company-size check after primary discovery", async () => {
    const runAgent = vi.fn().mockResolvedValueOnce(buildRunReport("run-1", "https://local-clinic.example/"));
    const fetchMock = vi.fn(async (url: URL | string) => {
      const requestUrl = new URL(String(url));
      const domain = requestUrl.searchParams.getAll("q_organization_domains_list[]")[0];
      if (domain === "big-clinic.example") {
        return new Response(JSON.stringify({ organizations: [{ primary_domain: "big-clinic.example", estimated_num_employees: 1200 }] }));
      }
      return new Response(JSON.stringify({ organizations: [{ primary_domain: "local-clinic.example", estimated_num_employees: 35 }] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await runDailyDiscoveryJob({
      env: {
        REVENUE_AGENT_DISCOVERY_ENABLED: "true",
        REVENUE_AGENT_DISCOVERY_DAILY_QUOTA: "5",
        APOLLO_API_KEY: "apollo-key",
        APOLLO_ORGANIZATION_SEARCH_API_BASE_URL: "https://apollo.test/api/v1/mixed_companies/search",
        APOLLO_ORGANIZATION_MAX_EMPLOYEES: "1000",
      } as NodeJS.ProcessEnv,
      sourceAdapters: [
        { id: "google_maps", discover: async () => [
          { source: "google_maps", url: "https://big-clinic.example/", businessName: "Big Clinic", sourceBusinessId: "place-big" },
          { source: "google_maps", url: "https://local-clinic.example/", businessName: "Local Clinic", sourceBusinessId: "place-local" },
        ] },
      ],
      listExistingSites: async () => [],
      validateUrl: async (url) => ({ ok: true, url }),
      runAgent,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(report.selectedCount).toBe(1);
    expect(report.skipped).toContainEqual({ url: "https://big-clinic.example/", reason: "apollo_company_too_large" });
    expect(runAgent).toHaveBeenCalledWith(expect.objectContaining({ targetUrl: "https://local-clinic.example/" }));
  });

  it("collects from multiple lead source adapters and continues after one source fails", async () => {
    const runAgent = vi.fn().mockResolvedValueOnce(buildRunReport("run-1", "https://maps.example/"));

    const report = await runDailyDiscoveryJob({
      env: {
        REVENUE_AGENT_DISCOVERY_ENABLED: "true",
        REVENUE_AGENT_DISCOVERY_DAILY_QUOTA: "5",
      } as NodeJS.ProcessEnv,
      sourceAdapters: [
        { id: "google_maps", discover: async () => [{ source: "google_maps", url: "https://maps.example/", businessName: "Maps Example", sourceBusinessId: "place-1" }] },
        { id: "technology_intelligence", discover: async () => [{ source: "technology_intelligence", domain: "maps.example", technologies: ["WordPress"] }] },
        { id: "google_search", discover: async () => { throw new Error("provider_failed"); } },
      ],
      listExistingSites: async () => [],
      validateUrl: async (url) => ({ ok: true, url }),
      runAgent,
    });

    expect(report.sources.map((source) => source.status)).toEqual(["passed", "passed", "failed"]);
    expect(report.candidateCount).toBe(1);
    expect(report.selectedCount).toBe(1);
    expect(runAgent).toHaveBeenCalledWith(expect.objectContaining({
      targetUrl: "https://maps.example/",
      metadata: {
        discovery: expect.objectContaining({
          sources: ["google_maps", "technology_intelligence"],
          businessName: "Maps Example",
        }),
      },
    }));
  });

  it("holds portal profile-only candidates before starting agent runs", async () => {
    const runAgent = vi.fn();

    const report = await runDailyDiscoveryJob({
      env: {
        REVENUE_AGENT_DISCOVERY_ENABLED: "true",
        REVENUE_AGENT_DISCOVERY_DAILY_QUOTA: "5",
      } as NodeJS.ProcessEnv,
      sourceAdapters: [
        { id: "portal_search", discover: async () => [{
          source: "portal_search",
          url: "https://portal.example/salon/123",
          businessName: "青山テストサロン",
          metadata: {
            portalUrl: "https://portal.example/salon/123",
            profileOnly: true,
            officialUrlExtracted: false,
          },
        }] },
      ],
      listExistingSites: async () => [],
      validateUrl: async (url) => ({ ok: true, url }),
      runAgent,
    });

    expect(report.selectedCount).toBe(0);
    expect(report.skipped).toContainEqual({ url: "https://portal.example/salon/123", reason: "portal_profile_only" });
    expect(runAgent).not.toHaveBeenCalled();
  });
});

function buildRunReport(id: string, targetUrl: string) {
  return {
    id,
    targetUrl,
    startedAt: "2026-05-14T00:00:00.000Z",
    completedAt: "2026-05-14T00:00:01.000Z",
    status: "passed" as const,
    steps: [],
    outputs: {},
  };
}
