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
      runAgent,
    });

    expect(report.selectedCount).toBe(2);
    expect(report.runs.map((run) => run.url)).toEqual(["https://seed.com/", "https://search.com/"]);
    expect(runAgent).toHaveBeenLastCalledWith(
      expect.objectContaining({
        targetUrl: "https://search.com/",
        metadata: { discovery: { source: "firecrawl_search", query: "tax accountant tokyo", title: "Search Result" } },
      }),
    );
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
