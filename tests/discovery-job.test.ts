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
      listExistingSites: async () => [
        {
          id: "site-1",
          normalizedUrl: "https://already.com/",
          displayUrl: "https://already.com/",
          domain: "already.com",
          latestStatus: "passed",
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
