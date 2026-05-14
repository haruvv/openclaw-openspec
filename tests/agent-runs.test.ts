import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("agent run repository", () => {
  beforeEach(async () => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "agent-runs-"));
    process.env.DB_PATH = join(dir, "pipeline.db");
  });

  it("persists run, step, and artifact records", async () => {
    const { createAgentRun, completeAgentRun, getAgentRunDetail, listAgentRuns } = await import(
      "../src/agent-runs/repository.js"
    );

    await createAgentRun({
      id: "run-1",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://example.com" },
      metadata: { requestedBy: "test" },
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
    });

    await completeAgentRun({
      id: "run-1",
      status: "passed",
      completedAt: new Date("2026-05-14T00:00:02.000Z"),
      summary: { targetUrl: "https://example.com", domain: "example.com", seoScore: 80 },
      steps: [
        {
          name: "crawl_and_score",
          status: "passed",
          durationMs: 120,
          details: { domain: "example.com" },
        },
      ],
      artifacts: [
        {
          type: "proposal",
          label: "example.com proposal",
          pathOrUrl: "/tmp/example.com.md",
          contentText: "# Proposal",
        },
      ],
    });

    const runs = await listAgentRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      id: "run-1",
      agentType: "revenue_agent",
      source: "manual",
      status: "passed",
      summary: { targetUrl: "https://example.com", domain: "example.com", seoScore: 80 },
    });

    const detail = await getAgentRunDetail("run-1");
    expect(detail?.steps[0]).toMatchObject({ name: "crawl_and_score", status: "passed", durationMs: 120 });
    expect(detail?.artifacts[0]).toMatchObject({
      type: "proposal",
      label: "example.com proposal",
      contentText: "# Proposal",
    });
  });
});
