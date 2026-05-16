import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalEnv = { ...process.env };

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{ statusCode: 202 }]) },
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    products: { create: vi.fn().mockResolvedValue({ id: "prod_test" }) },
    prices: { create: vi.fn().mockResolvedValue({ id: "price_test" }) },
    paymentLinks: { create: vi.fn().mockResolvedValue({ id: "plink_test", url: "https://buy.stripe.com/test" }) },
  })),
}));

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

  it("requires an admin auth boundary in production", async () => {
    const { adminRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminRouter, "/");

    expect(response.status).toBe(503);
    expect(response.body).toContain("Cloudflare Access");
  });

  it("does not accept admin token query parameters when Cloudflare Access is enabled", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    process.env.CLOUDFLARE_ACCESS_ENABLED = "true";
    process.env.CLOUDFLARE_ACCESS_ISSUER = "https://team.cloudflareaccess.com";
    process.env.CLOUDFLARE_ACCESS_ADMIN_AUD = "admin-aud";
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminApiRouter, "/apps?token=admin-test", "/api/admin");

    expect(response.status).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: "Unauthorized" });
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

  it("loads an outreach draft for a completed run", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { createAgentRun, completeAgentRun } = await import("../src/agent-runs/repository.js");
    await createAgentRun({
      id: "run-1",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://example.com/" },
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
    });
    await completeAgentRun({
      id: "run-1",
      status: "passed",
      completedAt: new Date("2026-05-14T00:00:01.000Z"),
      summary: {
        targetUrl: "https://example.com/",
        domain: "example.com",
        contactEmail: "info@example.com",
        contactMethods: [
          {
            type: "email",
            value: "contact@example.com",
            sourceUrl: "https://example.com/contact",
            confidence: "high",
          },
        ],
        llmRevenueAudit: {
          outreach: { subject: "簡易診断について", firstEmail: "必要でしたら要点を共有します。", followUpEmail: "" },
          caveats: ["アクセス数は未確認です。"],
        },
      },
      steps: [],
    });
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminApiRouter, "/seo-sales/runs/run-1/outreach-draft?token=admin-test", "/api/admin");

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body) as { draft: { recipientEmail: string; contactMethods: unknown[]; subject: string; bodyText: string } };
    expect(body.draft).toMatchObject({
      recipientEmail: "info@example.com",
      subject: "簡易診断について",
      bodyText: "必要でしたら要点を共有します。",
    });
    expect(body.draft.contactMethods).toHaveLength(1);
  });

  it("rejects outreach send when email side effects are disabled", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    const { createAgentRun, completeAgentRun } = await import("../src/agent-runs/repository.js");
    await createAgentRun({
      id: "run-1",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://example.com/" },
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
    });
    await completeAgentRun({
      id: "run-1",
      status: "passed",
      completedAt: new Date("2026-05-14T00:00:01.000Z"),
      summary: { targetUrl: "https://example.com/", domain: "example.com", contactEmail: "info@example.com" },
      steps: [],
    });
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminApiRouter, "/seo-sales/runs/run-1/outreach/send?token=admin-test", "/api/admin", {
      method: "POST",
      body: { recipientEmail: "info@example.com", subject: "確認", bodyText: "本文" },
    });

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body).error).toContain("email side effects are disabled");
  });

  it("sends reviewed outreach and prevents duplicate sends", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    process.env.REVENUE_AGENT_ALLOW_EMAIL = "true";
    process.env.SENDGRID_API_KEY = "sendgrid-test";
    process.env.SENDGRID_FROM_EMAIL = "from@example.com";
    const { createAgentRun, completeAgentRun } = await import("../src/agent-runs/repository.js");
    await createAgentRun({
      id: "run-1",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://example.com/" },
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
    });
    await completeAgentRun({
      id: "run-1",
      status: "passed",
      completedAt: new Date("2026-05-14T00:00:01.000Z"),
      summary: { targetUrl: "https://example.com/", domain: "example.com", contactEmail: "info@example.com" },
      steps: [],
    });
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const first = await dispatch(adminApiRouter, "/seo-sales/runs/run-1/outreach/send?token=admin-test", "/api/admin", {
      method: "POST",
      body: { recipientEmail: "info@example.com", subject: "確認", bodyText: "本文" },
    });
    const second = await dispatch(adminApiRouter, "/seo-sales/runs/run-1/outreach/send?token=admin-test", "/api/admin", {
      method: "POST",
      body: { recipientEmail: "info@example.com", subject: "確認", bodyText: "本文" },
    });

    expect(first.status).toBe(201);
    expect(JSON.parse(first.body).message).toMatchObject({ status: "sent", recipientEmail: "info@example.com" });
    expect(second.status).toBe(400);
    expect(JSON.parse(second.body).error).toContain("cooldown");
  });

  it("creates a reviewed payment link when payment policy is enabled", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    process.env.REVENUE_AGENT_ALLOW_PAYMENT_LINK = "true";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    const { createAgentRun, completeAgentRun } = await import("../src/agent-runs/repository.js");
    await createAgentRun({
      id: "run-1",
      agentType: "revenue_agent",
      source: "manual",
      input: { targetUrl: "https://example.com/" },
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
    });
    await completeAgentRun({
      id: "run-1",
      status: "passed",
      completedAt: new Date("2026-05-14T00:00:01.000Z"),
      summary: { targetUrl: "https://example.com/", domain: "example.com", contactEmail: "info@example.com" },
      steps: [],
    });
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const response = await dispatch(adminApiRouter, "/seo-sales/runs/run-1/payment-links?token=admin-test", "/api/admin", {
      method: "POST",
      body: { amountJpy: 30000, recipientEmail: "info@example.com", sendEmail: false },
    });

    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).paymentLink).toMatchObject({
      amountJpy: 30000,
      paymentLinkUrl: "https://buy.stripe.com/test",
      status: "created",
    });
  });

  it("returns and updates discovery settings from the admin API", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    process.env.REVENUE_AGENT_DISCOVERY_QUERIES = "税理士 ホームページ 改善";
    process.env.REVENUE_AGENT_DISCOVERY_DAILY_QUOTA = "2";
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const before = await dispatch(adminApiRouter, "/seo-sales/settings?token=admin-test", "/api/admin");
    expect(before.status).toBe(200);
    expect(JSON.parse(before.body)).toMatchObject({
      discovery: {
        queries: ["税理士 ホームページ 改善"],
        dailyQuota: 2,
        configuredFromAdmin: false,
      },
    });

    const update = await dispatch(adminApiRouter, "/seo-sales/settings/discovery?token=admin-test", "/api/admin", {
      method: "PUT",
      body: {
        queries: "整体院 SEO 集客\n歯科医院 Web集客",
        seedUrls: "https://example.com",
        dailyQuota: 4,
        searchLimit: 8,
        country: "JP",
        lang: "JA",
        location: "Tokyo",
      },
    });
    expect(update.status).toBe(200);
    expect(JSON.parse(update.body)).toMatchObject({
      discovery: {
        queries: ["整体院 SEO 集客", "歯科医院 Web集客"],
        seedUrls: ["https://example.com"],
        dailyQuota: 4,
        searchLimit: 8,
        country: "jp",
        lang: "ja",
        location: "Tokyo",
        configuredFromAdmin: true,
      },
    });

    const after = await dispatch(adminApiRouter, "/seo-sales/settings?token=admin-test", "/api/admin");
    expect(JSON.parse(after.body)).toMatchObject({
      discovery: {
        queries: ["整体院 SEO 集客", "歯科医院 Web集客"],
        configuredFromAdmin: true,
      },
    });
  });

  it("returns and updates side effect policies from the admin API", async () => {
    process.env.ADMIN_TOKEN = "admin-test";
    process.env.REVENUE_AGENT_ALLOW_EMAIL = "true";
    const { adminApiRouter } = await import("../src/admin/routes.js");

    const before = await dispatch(adminApiRouter, "/seo-sales/settings?token=admin-test", "/api/admin");
    expect(before.status).toBe(200);
    expect(JSON.parse(before.body)).toMatchObject({
      policies: [
        { key: "sendEmail", label: "メール送信", enabled: true },
        { key: "sendTelegram", label: "Telegram通知", enabled: false },
        { key: "createPaymentLink", label: "決済リンク作成", enabled: false },
      ],
    });

    const update = await dispatch(adminApiRouter, "/seo-sales/settings/policies?token=admin-test", "/api/admin", {
      method: "PUT",
      body: {
        sendEmail: false,
        sendTelegram: true,
        createPaymentLink: true,
      },
    });
    expect(update.status).toBe(200);
    expect(JSON.parse(update.body)).toMatchObject({
      policies: {
        sendEmail: false,
        sendTelegram: true,
        createPaymentLink: true,
        configuredFromAdmin: true,
      },
    });

    const after = await dispatch(adminApiRouter, "/seo-sales/settings?token=admin-test", "/api/admin");
    expect(JSON.parse(after.body)).toMatchObject({
      policies: [
        { key: "sendEmail", enabled: false },
        { key: "sendTelegram", enabled: true },
        { key: "createPaymentLink", enabled: true },
      ],
    });
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
