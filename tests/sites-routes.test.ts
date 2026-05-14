import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalEnv = { ...process.env };

describe("site result routes", () => {
  beforeEach(async () => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "sites-routes-"));
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      DB_PATH: join(dir, "pipeline.db"),
      FIRECRAWL_API_KEY: "firecrawl-test",
      GEMINI_API_KEY: "gemini-test",
      REVENUE_AGENT_INTEGRATION_TOKEN: "integration-test",
    };
  });

  it("requires ADMIN_TOKEN in production", async () => {
    const { sitesRouter } = await import("../src/sites/routes.js");

    const response = await dispatch(sitesRouter, "/");

    expect(response.status).toBe(503);
    expect(response.body).toContain("ADMIN_TOKEN");
  });

  it("renders site list and detail when token is provided", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { createAgentRun } = await import("../src/agent-runs/repository.js");
    const { persistSiteResult } = await import("../src/sites/repository.js");
    await createAgentRun({
      id: "run-1",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://example.com/" },
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
    });
    const site = await persistSiteResult({
      runId: "run-1",
      status: "passed",
      target: {
        id: "target-1",
        url: "https://example.com/",
        domain: "example.com",
        seoScore: 81,
        diagnostics: [],
        status: "crawled",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      summary: { seoScore: 81 },
      proposals: [{ label: "example.com proposal", contentText: "# Proposal" }],
      createdAt: new Date("2026-05-14T00:00:00.000Z"),
    });
    const { sitesRouter } = await import("../src/sites/routes.js");

    const listResponse = await dispatch(sitesRouter, "/?token=admin-test");
    const detailResponse = await dispatch(sitesRouter, `/${site.id}?token=admin-test`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toContain("Site Results");
    expect(listResponse.body).toContain("https://example.com/");
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body).toContain("Latest Proposal");
    expect(detailResponse.body).toContain("# Proposal");
  });
});

function dispatch(router: { handle: Function }, url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} }) as unknown as {
      method: string;
      url: string;
      headers: Record<string, string>;
      originalUrl?: string;
      query?: Record<string, string>;
      params?: Record<string, string>;
    };
    req.method = "GET";
    req.url = url;
    req.originalUrl = `/sites${url}`;
    req.headers = {};
    req.query = Object.fromEntries(new URL(`http://sites.test${url}`).searchParams.entries());

    const res = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      cookie() {
        return this;
      },
      send(body: string) {
        resolve({ status: this.statusCode, body });
        return this;
      },
      setHeader() {
        return this;
      },
      getHeader() {
        return undefined;
      },
      end(body?: string) {
        resolve({ status: this.statusCode, body: body ?? "" });
      },
    };

    router.handle(req, res, reject);
    req.push(null);
  });
}
