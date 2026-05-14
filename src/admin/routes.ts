import express, { Router } from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import { getAgentRunDetail, listAgentRuns } from "../agent-runs/repository.js";
import { runDailyDiscoveryJob } from "../discovery/job.js";
import { runRevenueAgent } from "../revenue-agent/runner.js";
import { applySideEffectPolicy, sideEffectPolicyReason, validateSafeTargetUrl } from "../revenue-agent/security.js";
import { getSiteDetail, listSites } from "../sites/repository.js";
import { businessApps } from "./business-apps.js";
import { isAdminAuthorized, isAdminTokenConfigured } from "./auth.js";

export const adminRouter = Router();
export const adminApiRouter = Router();

const adminUiDirs = uniquePaths([
  join(process.cwd(), "dist/admin-ui"),
  join(dirname(fileURLToPath(import.meta.url)), "..", "admin-ui"),
]);

export const adminAssetsRouter = Router();
for (const dir of adminUiDirs) {
  adminAssetsRouter.use(express.static(join(dir, "assets"), {
    immutable: true,
    index: false,
    maxAge: "1y",
  }));
}
adminAssetsRouter.use((_req, res) => {
  res.status(404).send("Not Found");
});

const adminUiStaticRouter = Router();
for (const dir of adminUiDirs) {
  adminUiStaticRouter.use(express.static(dir, { index: false }));
}

adminApiRouter.use(express.json());
adminApiRouter.use(requireAdminApiAuth);

adminApiRouter.get("/apps", (_req, res) => {
  res.json({ apps: businessApps });
});

adminApiRouter.get("/seo-sales/overview", async (_req, res) => {
  const [runs, sites] = await Promise.all([listAgentRuns(20), listSites(100)]);
  res.json({
    appId: "seo-sales",
    totals: {
      runs: runs.length,
      sites: sites.length,
      failedRuns: runs.filter((run) => run.status === "failed").length,
      latestScore: sites[0]?.latestSeoScore ?? null,
    },
    recentRuns: runs.slice(0, 5),
    recentSites: sites.slice(0, 5),
  });
});

adminApiRouter.get("/seo-sales/runs", async (_req, res) => {
  res.json({ runs: await listAgentRuns(100) });
});

adminApiRouter.post("/seo-sales/runs", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  const safeUrl = await validateSafeTargetUrl(url);
  if (!safeUrl.ok) {
    res.status(400).json({ error: safeUrl.error });
    return;
  }

  const report = await runManualRevenueAgent(safeUrl.url, {});
  res.status(201).json({ runId: report.id, location: `/admin/seo-sales/runs/${encodeURIComponent(report.id)}`, report });
});

adminApiRouter.get("/seo-sales/runs/:id", async (req, res) => {
  const run = await getAgentRunDetail(req.params.id);
  if (!run) {
    res.status(404).json({ error: "run_not_found" });
    return;
  }

  res.json({ run });
});

adminApiRouter.post("/seo-sales/runs/:id/retry", async (req, res) => {
  const prior = await getAgentRunDetail(req.params.id);
  const targetUrl = typeof prior?.input.targetUrl === "string" ? prior.input.targetUrl : undefined;
  if (!targetUrl) {
    res.status(400).json({ error: "original_run_has_no_target_url" });
    return;
  }

  const report = await runManualRevenueAgent(targetUrl, { retryOf: prior?.id });
  res.status(201).json({ runId: report.id, location: `/admin/seo-sales/runs/${encodeURIComponent(report.id)}`, report });
});

adminApiRouter.post("/seo-sales/discovery/run", async (_req, res) => {
  const report = await runDailyDiscoveryJob({ enabled: process.env.REVENUE_AGENT_DISCOVERY_MANUAL_ENABLED !== "false" });
  res.status(report.status === "failed" ? 502 : 200).json({ report });
});

adminApiRouter.get("/seo-sales/sites", async (_req, res) => {
  res.json({ sites: await listSites(200) });
});

adminApiRouter.get("/seo-sales/sites/:id", async (req, res) => {
  const site = await getSiteDetail(req.params.id);
  if (!site) {
    res.status(404).json({ error: "site_not_found" });
    return;
  }

  res.json({ site });
});

adminApiRouter.get("/seo-sales/settings", (_req, res) => {
  const integrations = [
    ["Firecrawl", "FIRECRAWL_API_KEY"],
    ["Gemini", "GEMINI_API_KEY"],
    ["Z.ai", "ZAI_API_KEY"],
    ["SendGrid", "SENDGRID_API_KEY"],
    ["Telegram bot", "TELEGRAM_BOT_TOKEN"],
    ["Telegram chat許可リスト", "TELEGRAM_CHAT_ID"],
    ["Telegram webhook secret", "TELEGRAM_WEBHOOK_SECRET"],
    ["Stripe", "STRIPE_SECRET_KEY"],
    ["管理トークン", "ADMIN_TOKEN"],
  ].map(([label, key]) => ({ label, key, configured: Boolean(process.env[key]) }));
  const policies = [
    ["メール送信", process.env.REVENUE_AGENT_ALLOW_EMAIL === "true"],
    ["Telegram通知", process.env.REVENUE_AGENT_ALLOW_TELEGRAM === "true"],
    ["決済リンク作成", process.env.REVENUE_AGENT_ALLOW_PAYMENT_LINK === "true"],
  ].map(([label, enabled]) => ({ label, enabled: Boolean(enabled) }));

  res.json({ integrations, policies });
});

adminRouter.use(
  "/assets",
  adminAssetsRouter,
);

adminRouter.use(requireAdminPageAuth);

adminRouter.get("/integrations", (_req, res) => {
  res.redirect(301, "/admin/seo-sales/settings");
});

adminRouter.post("/runs", (_req, res) => {
  res.redirect(307, "/api/admin/seo-sales/runs");
});

adminRouter.get("/runs", (_req, res) => {
  res.redirect(301, "/admin/seo-sales/runs");
});

adminRouter.get("/runs/:id", (req, res) => {
  res.redirect(301, `/admin/seo-sales/runs/${encodeURIComponent(req.params.id)}`);
});

adminRouter.post("/runs/:id/retry", (req, res) => {
  res.redirect(307, `/api/admin/seo-sales/runs/${encodeURIComponent(req.params.id)}/retry`);
});

adminRouter.use(adminUiStaticRouter);

adminRouter.get("*", (_req, res) => {
  const adminIndexPath = findAdminIndexPath();
  if (existsSync(adminIndexPath)) {
    res.sendFile(adminIndexPath);
    return;
  }

  res
    .status(503)
    .send(renderFallbackPage("管理画面を利用できません", "<p>管理画面のフロントエンドがまだビルドされていません。</p>"));
});

async function runManualRevenueAgent(targetUrl: string, metadata: Record<string, unknown>) {
  const requested = { sendEmail: false, sendTelegram: false, createPaymentLink: false };
  const allowed = applySideEffectPolicy(requested);
  return runRevenueAgent({
    targetUrl,
    source: "manual",
    metadata,
    sendEmail: allowed.sendEmail,
    sendTelegram: allowed.sendTelegram,
    createPaymentLink: allowed.createPaymentLink,
    sideEffectSkipReasons: {
      sendEmail: sideEffectPolicyReason("sendEmail"),
      sendTelegram: sideEffectPolicyReason("sendTelegram"),
      createPaymentLink: sideEffectPolicyReason("createPaymentLink"),
    },
  });
}

function requireAdminPageAuth(req: Request, res: Response, next: () => void): void {
  if (isAdminAuthorized(req, res)) {
    next();
    return;
  }

  if (isAdminTokenConfigured()) {
    res.status(401).send(renderFallbackPage("管理画面ログイン", renderLogin(req.originalUrl)));
    return;
  }

  if (process.env.NODE_ENV === "production") {
    res.status(503).send(renderFallbackPage("管理画面を利用できません", "<p>本番環境では <code>ADMIN_TOKEN</code> が必要です。</p>"));
    return;
  }

  next();
}

function requireAdminApiAuth(req: Request, res: Response, next: () => void): void {
  if (isAdminAuthorized(req, res)) {
    next();
    return;
  }

  if (process.env.NODE_ENV === "production" || isAdminTokenConfigured()) {
    res.status(401).json({ error: "admin_token_required" });
    return;
  }

  next();
}

function renderLogin(returnTo: string): string {
  return `
    <form method="get" action="${escapeHtml(returnTo.split("?")[0] || "/admin")}">
      <label>管理トークン<input name="token" type="password" autocomplete="current-password" /></label>
      <button type="submit">開く</button>
    </form>
  `;
}

function renderFallbackPage(title: string, body: string): string {
  return `<!doctype html>
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f7fb; color: #172033; font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          main { width: min(100%, 520px); background: white; border: 1px solid #d8dee8; border-radius: 10px; padding: 28px; box-shadow: 0 18px 45px rgba(20, 31, 52, 0.08); }
          h1 { margin: 0 0 18px; font-size: 22px; }
          form { display: grid; gap: 12px; }
          input { width: 100%; margin-top: 6px; padding: 10px; border: 1px solid #c8d0dc; border-radius: 8px; font: inherit; }
          button { padding: 10px 13px; border: 1px solid #155eef; border-radius: 8px; background: #155eef; color: white; font: inherit; font-weight: 700; cursor: pointer; }
        </style>
      </head>
      <body><main><h1>${escapeHtml(title)}</h1>${body}</main></body>
    </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function findAdminIndexPath(): string {
  return adminUiDirs.map((dir) => join(dir, "index.html")).find((path) => existsSync(path)) ?? join(adminUiDirs[0], "index.html");
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}
