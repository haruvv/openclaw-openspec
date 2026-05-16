import express, { Router } from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import { getAgentRunDetail, listAgentRuns } from "../agent-runs/repository.js";
import { runDailyDiscoveryJob } from "../discovery/job.js";
import { applyDiscoverySettingsToEnv, getDiscoverySettings, saveDiscoverySettings } from "../discovery/settings.js";
import { runRevenueAgent } from "../revenue-agent/runner.js";
import { applySideEffectPolicy, sideEffectPolicyReason, validateSafeTargetUrl } from "../revenue-agent/security.js";
import { getSiteDetail, listSites } from "../sites/repository.js";
import { buildOutreachDraft, createReviewedPaymentLink, getRunSalesState, sendReviewedOutreach } from "../sales/service.js";
import { getSalesOperationSettings, saveSalesOperationSettings } from "../sales/settings.js";
import { businessApps } from "./business-apps.js";
import { authorizeAdminRequest, isAdminTokenConfigured } from "./auth.js";
import { getSideEffectSettings, saveSideEffectSettings } from "./side-effect-settings.js";

export const adminRouter = Router();
export const adminApiRouter = Router();

const adminUiDirs = uniquePaths([
  join(process.cwd(), "dist-assets/admin"),
  join(process.cwd(), "dist/admin"),
  join(process.cwd(), "dist/admin-ui"),
  join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist-assets", "admin"),
  join(dirname(fileURLToPath(import.meta.url)), "..", "admin"),
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

  res.json({ run: { ...run, salesActions: await getRunSalesState(req.params.id) } });
});

adminApiRouter.get("/seo-sales/runs/:id/outreach-draft", async (req, res) => {
  const draft = await buildOutreachDraft(req.params.id);
  if (!draft) {
    res.status(404).json({ error: "outreach_draft_not_found" });
    return;
  }

  res.json({ draft, salesActions: await getRunSalesState(req.params.id) });
});

adminApiRouter.post("/seo-sales/runs/:id/outreach/send", async (req, res) => {
  const parsed = parseOutreachSendBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const message = await sendReviewedOutreach({ runId: req.params.id, ...parsed.value });
    res.status(201).json({ message, salesActions: await getRunSalesState(req.params.id) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "outreach_send_failed" });
  }
});

adminApiRouter.post("/seo-sales/runs/:id/payment-links", async (req, res) => {
  const parsed = parsePaymentLinkBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const paymentLink = await createReviewedPaymentLink({ runId: req.params.id, ...parsed.value });
    res.status(201).json({ paymentLink, salesActions: await getRunSalesState(req.params.id) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "payment_link_failed" });
  }
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
  const settings = await getDiscoverySettings();
  const report = await runDailyDiscoveryJob({
    enabled: process.env.REVENUE_AGENT_DISCOVERY_MANUAL_ENABLED !== "false",
    env: applyDiscoverySettingsToEnv(process.env, settings),
  });
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

adminApiRouter.get("/seo-sales/settings", async (_req, res) => {
  const sideEffects = await getSideEffectSettings();
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
    ["sendEmail", "メール送信", sideEffects.sendEmail],
    ["sendTelegram", "Telegram通知", sideEffects.sendTelegram],
    ["createPaymentLink", "決済リンク作成", sideEffects.createPaymentLink],
  ].map(([key, label, enabled]) => ({ key, label, enabled: Boolean(enabled) }));

  res.json({ integrations, policies, discovery: await getDiscoverySettings(), sales: await getSalesOperationSettings() });
});

adminApiRouter.put("/seo-sales/settings/discovery", async (req, res) => {
  const discovery = await saveDiscoverySettings(req.body ?? {});
  res.json({ discovery });
});

adminApiRouter.put("/seo-sales/settings/policies", async (req, res) => {
  const policies = await saveSideEffectSettings(req.body ?? {});
  res.json({ policies });
});

adminApiRouter.put("/seo-sales/settings/sales", async (req, res) => {
  const sales = await saveSalesOperationSettings(req.body ?? {});
  res.json({ sales });
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

function parseOutreachSendBody(body: unknown):
  | { ok: true; value: { recipientEmail: string; subject: string; bodyText: string } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be an object" };
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.recipientEmail !== "string") return { ok: false, error: "recipientEmail is required" };
  if (typeof candidate.subject !== "string") return { ok: false, error: "subject is required" };
  if (typeof candidate.bodyText !== "string") return { ok: false, error: "bodyText is required" };
  return {
    ok: true,
    value: {
      recipientEmail: candidate.recipientEmail,
      subject: candidate.subject,
      bodyText: candidate.bodyText,
    },
  };
}

function parsePaymentLinkBody(body: unknown):
  | { ok: true; value: { outreachMessageId?: string; recipientEmail?: string; amountJpy: number; sendEmail?: boolean } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be an object" };
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.amountJpy !== "number" || !Number.isInteger(candidate.amountJpy) || candidate.amountJpy <= 0) {
    return { ok: false, error: "amountJpy must be a positive integer" };
  }
  if (candidate.outreachMessageId !== undefined && typeof candidate.outreachMessageId !== "string") {
    return { ok: false, error: "outreachMessageId must be a string" };
  }
  if (candidate.recipientEmail !== undefined && typeof candidate.recipientEmail !== "string") {
    return { ok: false, error: "recipientEmail must be a string" };
  }
  if (candidate.sendEmail !== undefined && typeof candidate.sendEmail !== "boolean") {
    return { ok: false, error: "sendEmail must be a boolean" };
  }
  return {
    ok: true,
    value: {
      outreachMessageId: candidate.outreachMessageId,
      recipientEmail: candidate.recipientEmail,
      amountJpy: candidate.amountJpy,
      sendEmail: candidate.sendEmail,
    },
  };
}

async function requireAdminPageAuth(req: Request, res: Response, next: () => void): Promise<void> {
  const auth = await authorizeAdminRequest(req, res);
  if (auth.ok) {
    next();
    return;
  }

  if (auth.status === 401 && isAdminTokenConfigured() && auth.reason === "token") {
    res.status(401).send(renderFallbackPage("管理画面ログイン", renderLogin(req.originalUrl)));
    return;
  }

  if (auth.status === 503) {
    res.status(503).send(renderFallbackPage("管理画面を利用できません", "<p>本番環境では Cloudflare Access または一時 fallback 認証の設定が必要です。</p>"));
    return;
  }

  res.status(401).send(renderFallbackPage("管理画面ログイン", "<p>Cloudflare Access 認証が必要です。</p>"));
}

async function requireAdminApiAuth(req: Request, res: Response, next: () => void): Promise<void> {
  const auth = await authorizeAdminRequest(req, res);
  if (auth.ok) {
    next();
    return;
  }

  res.status(auth.status).json({ error: auth.error });
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
