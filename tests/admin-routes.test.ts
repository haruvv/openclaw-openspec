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

  it("renders the run list when token is provided", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { adminRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminRouter, "/?token=admin-test");

    expect(response.status).toBe(200);
    expect(response.body).toContain("運用ダッシュボード");
    expect(response.body).toContain("最近の実行");
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
    };
    req.method = "GET";
    req.url = url;
    req.originalUrl = `/admin${url}`;
    req.headers = {};
    req.query = Object.fromEntries(new URL(`http://admin.test${url}`).searchParams.entries());

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
