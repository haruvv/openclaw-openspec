import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Target } from "../src/types/index.js";

describe("site results repository", () => {
  beforeEach(async () => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "site-results-"));
    process.env.DB_PATH = join(dir, "pipeline.db");
  });

  it("persists latest site state and keeps snapshot history newest first", async () => {
    const { createAgentRun } = await import("../src/agent-runs/repository.js");
    const { getSiteDetail, listSites, persistSiteResult } = await import("../src/sites/repository.js");

    await createAgentRun({
      id: "run-1",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://example.com/" },
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
    });
    await createAgentRun({
      id: "run-2",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://example.com/" },
      startedAt: new Date("2026-05-14T00:05:00.000Z"),
    });

    await persistSiteResult({
      runId: "run-1",
      status: "passed",
      target: target({ seoScore: 70 }),
      summary: { seoScore: 70, opportunityScore: 72 },
      createdAt: new Date("2026-05-14T00:00:00.000Z"),
      proposals: [{ label: "example.com proposal", contentText: "# First" }],
    });
    await persistSiteResult({
      runId: "run-2",
      status: "passed",
      target: target({ seoScore: 88, opportunityScore: 66 }),
      summary: { seoScore: 88, opportunityScore: 66 },
      createdAt: new Date("2026-05-14T00:05:00.000Z"),
      proposals: [{ label: "example.com proposal", contentText: "# Latest" }],
    });

    const sites = await listSites();
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({
      displayUrl: "https://example.com/",
      domain: "example.com",
      latestSeoScore: 88,
      latestOpportunityScore: 66,
      latestRunId: "run-2",
    });

    const detail = await getSiteDetail(sites[0].id);
    expect(detail?.snapshots.map((snapshot) => snapshot.runId)).toEqual(["run-2", "run-1"]);
    expect(detail?.snapshots[0]).toMatchObject({ opportunityScore: 66 });
    expect(detail?.snapshots[0].opportunityFindings[0]).toMatchObject({ category: "content" });
    expect(detail?.proposals[0]).toMatchObject({ runId: "run-2", contentText: "# Latest" });
  });

  it("reads legacy site rows without opportunity fields as unavailable", async () => {
    const { createAgentRun } = await import("../src/agent-runs/repository.js");
    const { getSiteDetail, persistSiteResult } = await import("../src/sites/repository.js");

    await createAgentRun({
      id: "run-legacy",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://legacy.example.com/" },
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
    });
    const detail = await persistSiteResult({
      runId: "run-legacy",
      status: "passed",
      target: target({ url: "https://legacy.example.com/", domain: "legacy.example.com", opportunityScore: undefined, opportunityFindings: undefined }),
      summary: { seoScore: 80 },
      createdAt: new Date("2026-05-14T00:00:00.000Z"),
    });

    const reloaded = await getSiteDetail(detail.id);
    expect(reloaded?.latestOpportunityScore).toBeUndefined();
    expect(reloaded?.snapshots[0].opportunityFindings).toEqual([]);
  });
});

function target(overrides: Partial<Target> = {}): Target {
  return {
    id: "target-1",
    url: "https://example.com/",
    domain: "example.com",
    seoScore: 80,
    diagnostics: [{ id: "meta-description", title: "Meta description", score: 1, description: "ok" }],
    opportunityScore: 72,
    opportunityFindings: [{
      category: "content",
      severity: "medium",
      title: "本文量に改善余地",
      evidence: "本文量が少ない",
      recommendation: "サービス説明を追加する",
      scoreImpact: 10,
    }],
    status: "crawled",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}
