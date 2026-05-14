import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalEnv = { ...process.env };

describe("admin routes", () => {
  beforeEach(async () => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "admin-routes-"));
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
    const { adminRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminRouter, "/");

    expect(response.status).toBe(503);
    expect(response.body).toContain("ADMIN_TOKEN");
  });

  it("returns business apps from the admin API when token is provided", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminApiRouter, "/apps?token=admin-test", "/api/admin");

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as { apps: Array<{ name: string }> };
    expect(body.apps.map((app) => app.name)).toContain("SEO営業");
    expect(body.apps.map((app) => app.name)).toContain("株自動売買");
  });

  it("returns the SEO sales run list from the admin API", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminApiRouter, "/seo-sales/runs?token=admin-test", "/api/admin");

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ runs: [] });
  });

  it("returns SEO sales site results from the admin API", async () => {
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
    await persistSiteResult({
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
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminApiRouter, "/seo-sales/sites?token=admin-test", "/api/admin");

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as { sites: Array<{ displayUrl: string; latestSeoScore: number }> };
    expect(body.sites[0]).toMatchObject({ displayUrl: "https://example.com/", latestSeoScore: 81 });
  });

  it("can run discovery from the admin API even when cron discovery is disabled", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    process.env.REVENUE_AGENT_DISCOVERY_ENABLED = "false";
    process.env.REVENUE_AGENT_DISCOVERY_SEED_URLS = "";
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminApiRouter, "/seo-sales/discovery/run?token=admin-test", "/api/admin", {
      method: "POST",
      body: {},
    });

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as { report: { status: string; enabled: boolean; selectedCount: number } };
    expect(body.report).toMatchObject({ status: "skipped", enabled: true, selectedCount: 0 });
  });

  it("can explicitly disable manual discovery from the admin API", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    process.env.REVENUE_AGENT_DISCOVERY_ENABLED = "true";
    process.env.REVENUE_AGENT_DISCOVERY_MANUAL_ENABLED = "false";
    process.env.REVENUE_AGENT_DISCOVERY_SEED_URLS = "https://example.com";
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminApiRouter, "/seo-sales/discovery/run?token=admin-test", "/api/admin", {
      method: "POST",
      body: {},
    });

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as { report: { status: string; enabled: boolean; selectedCount: number } };
    expect(body.report).toMatchObject({ status: "disabled", enabled: false, selectedCount: 0 });
  });

  it("redirects legacy run URLs to SEO sales routes", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { adminRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminRouter, "/runs/run-1?token=admin-test");

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe("/admin/seo-sales/runs/run-1");
  });
});

function dispatch(
  router: { handle: Function },
  url: string,
  mount = "/admin",
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() {} }) as unknown as {
      method: string;
      url: string;
      headers: Record<string, string>;
      originalUrl?: string;
      query?: Record<string, string>;
    };
    req.method = options.method ?? "GET";
    req.url = url;
    req.originalUrl = `${mount}${url}`;
    const bodyText = options.body === undefined ? "" : JSON.stringify(options.body);
    req.headers = bodyText ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(bodyText)) } : {};
    req.query = Object.fromEntries(new URL(`http://admin.test${url}`).searchParams.entries());

    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      cookie() {
        return this;
      },
      send(body: string) {
        resolve({ status: this.statusCode, body, headers: this.headers });
        return this;
      },
      json(body: unknown) {
        this.headers["content-type"] = "application/json";
        resolve({ status: this.statusCode, body: JSON.stringify(body), headers: this.headers });
        return this;
      },
      redirect(codeOrUrl: number | string, maybeUrl?: string) {
        const code = typeof codeOrUrl === "number" ? codeOrUrl : 302;
        const location = typeof codeOrUrl === "number" ? maybeUrl ?? "" : codeOrUrl;
        this.statusCode = code;
        this.headers.location = location;
        resolve({ status: this.statusCode, body: "", headers: this.headers });
        return this;
      },
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
        return this;
      },
      getHeader(name: string) {
        return this.headers[name.toLowerCase()];
      },
      end(body?: string) {
        resolve({ status: this.statusCode, body: body ?? "", headers: this.headers });
      },
    };

    router.handle(req, res, reject);
    req.push(bodyText || null);
    if (bodyText) req.push(null);
  });
}
