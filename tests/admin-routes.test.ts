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

  it("renders the business app portal when token is provided", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { adminRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminRouter, "/?token=admin-test");

    expect(response.status).toBe(200);
    expect(response.body).toContain("管理画面");
    expect(response.body).toContain("SEO営業");
    expect(response.body).toContain("株自動売買");
  });

  it("renders the SEO sales run list under the app path", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { adminRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminRouter, "/seo-sales/runs?token=admin-test");

    expect(response.status).toBe(200);
    expect(response.body).toContain("SEO営業 実行ログ");
    expect(response.body).toContain("最近の実行");
  });

  it("redirects legacy run URLs to SEO sales routes", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { adminRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminRouter, "/runs/run-1?token=admin-test");

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe("/admin/seo-sales/runs/run-1");
  });
});

function dispatch(router: { handle: Function }, url: string): Promise<{ status: number; body: string; headers: Record<string, string> }> {
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
    req.push(null);
  });
}
