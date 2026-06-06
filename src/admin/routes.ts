import express, { Router } from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import { createAgentRun, getAgentRunDetail, listAgentRuns } from "../agent-runs/repository.js";
import { addContactSuppression, listContactSuppressions } from "../contact-discovery/suppression.js";
import { runDailyDiscoveryJob } from "../discovery/job.js";
import { listLeadCandidates } from "../discovery/repository.js";
import { applyDiscoverySettingsToEnv, getDiscoverySettings, saveDiscoverySettings } from "../discovery/settings.js";
import { createRevenueAgentRunId, runRevenueAgent } from "../revenue-agent/runner.js";
import { applySideEffectPolicy, sideEffectPolicyReason, validateSafeTargetUrl } from "../revenue-agent/security.js";
import { getSiteDetail, listSites } from "../sites/repository.js";
import { buildOutreachDraft, createReviewedPaymentLink, getRunSalesState, sendReviewedOutreach } from "../sales/service.js";
import { getSalesOperationSettings, saveSalesOperationSettings } from "../sales/settings.js";
import { runStockBacktest } from "../stock-trading/backtest-runner.js";
import { runStockAutonomousPaperCycle } from "../stock-trading/automation.js";
import { convertStockMarketCandidateToPaperDecision } from "../stock-trading/candidate-converter.js";
import { runStockMarketDataCollector } from "../stock-trading/market-data-collector.js";
import { scanStockMarketDataCandidates } from "../stock-trading/market-data-scanner.js";
import { reviewStockPositionExit } from "../stock-trading/paper-runner.js";
import {
  getStockBacktestRunDetail,
  createStockResearchItem,
  getStockAiDecisionDetail,
  getStockIntegrationStatus,
  getStockRunnerStatus,
  getStockTradingOverview,
  listStockBacktestRuns,
  listStockCandles,
  listStockAiDecisions,
  listStockLearningItems,
  listStockMarketCandidates,
  listStockMarketDataCollectionRuns,
  listStockMarketDataWatchlistEntries,
  listStockMarketSignals,
  listStockPositions,
  listStockResearchItems,
  listStockStrategyPerformance,
  listStockTrades,
  listStockTradingRules,
  updateStockMarketCandidateStatus,
  updateStockMarketDataWatchlistEntry,
  updateStockTradingRuleStatus,
  upsertStockMarketDataWatchlistEntry,
  upsertStockCandles,
} from "../stock-trading/repository.js";
import type { CreateStockCandleInput, CreateStockResearchItemInput, RunStockBacktestInput, StockMarketCandidateStatus, StockResearchCategory, StockResearchSentiment, StockTradeAction, StockTradingRuleStatus, UpdateStockMarketDataWatchlistInput, UpsertStockMarketDataWatchlistInput } from "../stock-trading/types.js";
import { logger } from "../utils/logger.js";
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

adminApiRouter.get("/stock-trading/overview", async (_req, res) => {
  res.json(await getStockTradingOverview());
});

adminApiRouter.get("/stock-trading/decisions", async (_req, res) => {
  res.json({ decisions: await listStockAiDecisions(100) });
});

adminApiRouter.get("/stock-trading/candidates", async (req, res) => {
  const status = parseStockCandidateStatus(typeof req.query.status === "string" ? req.query.status : undefined);
  if (typeof req.query.status === "string" && !status) {
    res.status(400).json({ error: "invalid_candidate_status" });
    return;
  }
  res.json({ candidates: await listStockMarketCandidates({ status, limit: 200 }) });
});

adminApiRouter.patch("/stock-trading/candidates/:id", async (req, res) => {
  const status = parseStockCandidateStatus(typeof req.body?.status === "string" ? req.body.status : undefined);
  if (!status || status === "converted_to_decision") {
    res.status(400).json({ error: "invalid_candidate_status" });
    return;
  }
  try {
    res.json({ candidate: await updateStockMarketCandidateStatus(req.params.id, status) });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "stock_candidate_not_found" });
  }
});

adminApiRouter.post("/stock-trading/candidates/:id/convert", async (req, res) => {
  try {
    const converted = await convertStockMarketCandidateToPaperDecision(req.params.id, {
      price: readPositiveNumber(req.body?.price) ?? undefined,
      suggestedAction: parseStockTradeAction(typeof req.body?.suggestedAction === "string" ? req.body.suggestedAction : undefined),
    });
    res.status(201).json(converted);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "stock_candidate_not_found" ? 404 : 400).json({ error: message });
  }
});

adminApiRouter.get("/stock-trading/decisions/:id", async (req, res) => {
  const decision = await getStockAiDecisionDetail(req.params.id);
  if (!decision) {
    res.status(404).json({ error: "stock_decision_not_found" });
    return;
  }

  res.json({ decision });
});

adminApiRouter.get("/stock-trading/trades", async (_req, res) => {
  res.json({ trades: await listStockTrades(200) });
});

adminApiRouter.get("/stock-trading/strategies", async (_req, res) => {
  res.json({ strategies: await listStockStrategyPerformance(200) });
});

adminApiRouter.get("/stock-trading/candles", async (req, res) => {
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol : "";
  const timeframe = typeof req.query.timeframe === "string" ? req.query.timeframe : "";
  if (!symbol || !timeframe) {
    res.status(400).json({ error: "symbol_and_timeframe_required" });
    return;
  }
  res.json({ candles: await listStockCandles({ symbol, timeframe, limit: 1000 }) });
});

adminApiRouter.post("/stock-trading/candles", async (req, res) => {
  const parsed = parseStockCandleImportBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  res.status(201).json({ candles: await upsertStockCandles(parsed.value) });
});

adminApiRouter.get("/stock-trading/market-data/watchlist", async (_req, res) => {
  res.json({ entries: await listStockMarketDataWatchlistEntries({ limit: 200 }) });
});

adminApiRouter.post("/stock-trading/market-data/watchlist", async (req, res) => {
  const parsed = parseStockMarketDataWatchlistBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  res.status(201).json({ entry: await upsertStockMarketDataWatchlistEntry(parsed.value) });
});

adminApiRouter.patch("/stock-trading/market-data/watchlist/:id", async (req, res) => {
  const parsed = parseStockMarketDataWatchlistPatchBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    res.json({ entry: await updateStockMarketDataWatchlistEntry(req.params.id, parsed.value) });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "stock_market_data_watchlist_not_found" });
  }
});

adminApiRouter.get("/stock-trading/market-data/runs", async (_req, res) => {
  res.json({ runs: await listStockMarketDataCollectionRuns(100) });
});

adminApiRouter.post("/stock-trading/market-data/collect", async (_req, res) => {
  res.status(201).json({ run: await runStockMarketDataCollector() });
});

adminApiRouter.post("/stock-trading/market-data/scan", async (_req, res) => {
  res.status(201).json(await scanStockMarketDataCandidates());
});

adminApiRouter.post("/stock-trading/automation/run", async (_req, res) => {
  const result = await runStockAutonomousPaperCycle();
  res.status(201).json(result);
});

adminApiRouter.get("/stock-trading/backtests", async (_req, res) => {
  res.json({ runs: await listStockBacktestRuns(100) });
});

adminApiRouter.post("/stock-trading/backtests", async (req, res) => {
  const parsed = parseStockBacktestBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    res.status(201).json({ run: await runStockBacktest(parsed.value) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

adminApiRouter.get("/stock-trading/backtests/:id", async (req, res) => {
  const run = await getStockBacktestRunDetail(req.params.id);
  if (!run) {
    res.status(404).json({ error: "stock_backtest_not_found" });
    return;
  }
  res.json({ run });
});

adminApiRouter.get("/stock-trading/positions", async (_req, res) => {
  res.json({ positions: await listStockPositions({ openOnly: true, limit: 200 }) });
});

adminApiRouter.post("/stock-trading/positions/:symbol/exit-review", async (req, res) => {
  try {
    res.status(201).json({ result: await reviewStockPositionExit(req.params.symbol) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(message.startsWith("stock_open_position_not_found:") ? 404 : 400).json({ error: message });
  }
});

adminApiRouter.get("/stock-trading/signals", async (_req, res) => {
  res.json({ signals: await listStockMarketSignals(200) });
});

adminApiRouter.get("/stock-trading/research", async (req, res) => {
  const symbol = typeof req.query.symbol === "string" && req.query.symbol.trim().length > 0 ? req.query.symbol : undefined;
  res.json({ research: await listStockResearchItems({ symbol, includeMarketWide: Boolean(symbol), limit: 200 }) });
});

adminApiRouter.post("/stock-trading/research", async (req, res) => {
  const parsed = parseStockResearchBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  res.status(201).json({ item: await createStockResearchItem(parsed.value) });
});

adminApiRouter.get("/stock-trading/lessons", async (_req, res) => {
  res.json({ lessons: await listStockLearningItems(200) });
});

adminApiRouter.get("/stock-trading/rules", async (req, res) => {
  const status = parseStockTradingRuleStatus(typeof req.query.status === "string" ? req.query.status : undefined);
  if (typeof req.query.status === "string" && !status) {
    res.status(400).json({ error: "invalid_rule_status" });
    return;
  }
  res.json({ rules: await listStockTradingRules({ status, limit: 200 }) });
});

adminApiRouter.patch("/stock-trading/rules/:id", async (req, res) => {
  const status = parseStockTradingRuleStatus(typeof req.body?.status === "string" ? req.body.status : undefined);
  if (!status) {
    res.status(400).json({ error: "invalid_rule_status" });
    return;
  }
  try {
    res.json({ rule: await updateStockTradingRuleStatus(req.params.id, status) });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "stock_rule_not_found" });
  }
});

adminApiRouter.get("/stock-trading/settings", async (_req, res) => {
  const latestSignals = await listStockMarketSignals(1);
  res.json({
    integrations: await getStockIntegrationStatus(),
    runner: getStockRunnerStatus(),
    tradingView: {
      webhookPath: "/webhooks/stock-trading/tradingview",
      secretHeader: "x-tradingview-secret",
      latestSignal: latestSignals[0] ?? null,
    },
    safety: {
      mode: "paper_only",
      realOrderPlacementEnabled: false,
      message: "株自動売買MVPは内部ペーパー取引のみを記録します。実弾注文、取消、資金移動は実行しません。",
    },
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

  const run = await startManualRevenueAgent(safeUrl.url, {});
  res.status(202).json({ runId: run.id, location: `/admin/seo-sales/runs/${encodeURIComponent(run.id)}` });
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

  const run = await startManualRevenueAgent(targetUrl, { retryOf: prior?.id });
  res.status(202).json({ runId: run.id, location: `/admin/seo-sales/runs/${encodeURIComponent(run.id)}` });
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
    ["ポータル/指定サイト検索 APIキー", "GOOGLE_SEARCH_API_KEY"],
    ["ポータル/指定サイト検索 CX", "GOOGLE_SEARCH_CX"],
    ["Google Maps", "GOOGLE_MAPS_API_KEY"],
    ["Apollo", "APOLLO_API_KEY"],
    ["Hunter", "HUNTER_API_KEY"],
    ["BuiltWith", "BUILTWITH_API_KEY"],
    ["Wappalyzer", "WAPPALYZER_API_KEY"],
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

  res.json({
    integrations,
    policies,
    discovery: await getDiscoverySettings(),
    sales: await getSalesOperationSettings(),
    contactSuppressions: await listContactSuppressions(),
  });
});

adminApiRouter.put("/seo-sales/settings/discovery", async (req, res) => {
  const discovery = await saveDiscoverySettings(req.body ?? {});
  res.json({ discovery });
});

adminApiRouter.get("/seo-sales/leads", async (_req, res) => {
  res.json({ candidates: await listLeadCandidates() });
});

adminApiRouter.put("/seo-sales/settings/policies", async (req, res) => {
  const policies = await saveSideEffectSettings(req.body ?? {});
  res.json({ policies });
});

adminApiRouter.put("/seo-sales/settings/sales", async (req, res) => {
  const sales = await saveSalesOperationSettings(req.body ?? {});
  res.json({ sales });
});

adminApiRouter.get("/seo-sales/contact-suppressions", async (_req, res) => {
  res.json({ suppressions: await listContactSuppressions() });
});

adminApiRouter.post("/seo-sales/contact-suppressions", async (req, res) => {
  const parsed = parseContactSuppressionBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const suppression = await addContactSuppression({ ...parsed.value, source: "admin" });
  res.status(201).json({ suppression, suppressions: await listContactSuppressions() });
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

async function runManualRevenueAgent(targetUrl: string, metadata: Record<string, unknown>, runId?: string) {
  const requested = { sendEmail: false, sendTelegram: false, createPaymentLink: false };
  const allowed = applySideEffectPolicy(requested);
  return runRevenueAgent({
    runId,
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

async function startManualRevenueAgent(targetUrl: string, metadata: Record<string, unknown>) {
  const id = createRevenueAgentRunId();
  await createAgentRun({
    id,
    agentType: "revenue_agent",
    source: "manual",
    input: {
      targetUrl,
      sendEmail: false,
      sendTelegram: false,
      createPaymentLink: false,
    },
    metadata,
    startedAt: new Date(),
  });

  void runManualRevenueAgent(targetUrl, metadata, id).catch((error) => {
    logger.error("Manual revenue agent run failed after async start", { id, error });
  });

  return { id };
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

function parseContactSuppressionBody(body: unknown):
  | { ok: true; value: { kind: "email" | "domain"; value: string; reason: string } }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be an object" };
  const candidate = body as Record<string, unknown>;
  if (candidate.kind !== "email" && candidate.kind !== "domain") return { ok: false, error: "kind must be email or domain" };
  if (typeof candidate.value !== "string" || candidate.value.trim().length === 0) return { ok: false, error: "value is required" };
  const value = candidate.value.trim().toLowerCase();
  if (candidate.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { ok: false, error: "value must be a valid email" };
  }
  if (candidate.kind === "domain" && !/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/.*)?$/i.test(value)) {
    return { ok: false, error: "value must be a valid domain" };
  }
  return {
    ok: true,
    value: {
      kind: candidate.kind,
      value,
      reason: typeof candidate.reason === "string" && candidate.reason.trim() ? candidate.reason.trim().slice(0, 200) : "do_not_contact",
    },
  };
}

function parseStockResearchBody(body: unknown):
  | { ok: true; value: CreateStockResearchItemInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be an object" };
  const candidate = body as Record<string, unknown>;
  if (candidate.symbol !== undefined && typeof candidate.symbol !== "string") return { ok: false, error: "symbol must be a string" };
  if (!isStockResearchCategory(candidate.category)) return { ok: false, error: "category is invalid" };
  if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) return { ok: false, error: "title is required" };
  if (typeof candidate.summary !== "string" || candidate.summary.trim().length === 0) return { ok: false, error: "summary is required" };
  if (typeof candidate.source !== "string" || candidate.source.trim().length === 0) return { ok: false, error: "source is required" };
  if (candidate.sourceUrl !== undefined && typeof candidate.sourceUrl !== "string") return { ok: false, error: "sourceUrl must be a string" };
  if (candidate.sentiment !== undefined && !isStockResearchSentiment(candidate.sentiment)) return { ok: false, error: "sentiment is invalid" };
  if (candidate.importance !== undefined && (typeof candidate.importance !== "number" || !Number.isFinite(candidate.importance))) {
    return { ok: false, error: "importance must be a number" };
  }
  if (candidate.rawPayload !== undefined && (!candidate.rawPayload || typeof candidate.rawPayload !== "object" || Array.isArray(candidate.rawPayload))) {
    return { ok: false, error: "rawPayload must be an object" };
  }
  const symbol = typeof candidate.symbol === "string" ? candidate.symbol.trim() : "";
  const sourceUrl = typeof candidate.sourceUrl === "string" ? candidate.sourceUrl.trim() : "";
  const publishedAt = typeof candidate.publishedAt === "string" && candidate.publishedAt ? new Date(candidate.publishedAt) : undefined;
  return {
    ok: true,
    value: {
      symbol: symbol || undefined,
      category: candidate.category,
      title: candidate.title.trim(),
      summary: candidate.summary.trim(),
      source: candidate.source.trim(),
      sourceUrl: sourceUrl || undefined,
      sentiment: candidate.sentiment,
      importance: candidate.importance,
      rawPayload: candidate.rawPayload as Record<string, unknown> | undefined,
      publishedAt,
    },
  };
}

function parseStockCandleImportBody(body: unknown):
  | { ok: true; value: CreateStockCandleInput[] }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be an object" };
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.symbol !== "string" || candidate.symbol.trim().length === 0) return { ok: false, error: "symbol is required" };
  if (typeof candidate.timeframe !== "string" || candidate.timeframe.trim().length === 0) return { ok: false, error: "timeframe is required" };
  if (!Array.isArray(candidate.candles) || candidate.candles.length === 0) return { ok: false, error: "candles are required" };
  const candles: CreateStockCandleInput[] = [];
  for (const value of candidate.candles) {
    if (!value || typeof value !== "object") return { ok: false, error: "each candle must be an object" };
    const candle = value as Record<string, unknown>;
    const timestampValue = typeof candle.timestamp === "string" || typeof candle.timestamp === "number" ? new Date(candle.timestamp) : null;
    if (!timestampValue || Number.isNaN(timestampValue.getTime())) return { ok: false, error: "candle timestamp is invalid" };
    const open = readFiniteNumber(candle.open);
    const high = readFiniteNumber(candle.high);
    const low = readFiniteNumber(candle.low);
    const close = readFiniteNumber(candle.close);
    const volume = readFiniteNumber(candle.volume);
    if (open === null || high === null || low === null || close === null || volume === null) return { ok: false, error: "candle OHLCV values must be numbers" };
    candles.push({
      symbol: candidate.symbol.trim(),
      timeframe: candidate.timeframe.trim(),
      open,
      high,
      low,
      close,
      volume,
      source: typeof candidate.source === "string" && candidate.source.trim() ? candidate.source.trim() : "manual",
      timestamp: timestampValue,
    });
  }
  return { ok: true, value: candles };
}

function parseStockMarketDataWatchlistBody(body: unknown):
  | { ok: true; value: UpsertStockMarketDataWatchlistInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be an object" };
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.symbol !== "string" || candidate.symbol.trim().length === 0) return { ok: false, error: "symbol is required" };
  if (typeof candidate.timeframe !== "string" || candidate.timeframe.trim().length === 0) return { ok: false, error: "timeframe is required" };
  if (candidate.provider !== undefined && (typeof candidate.provider !== "string" || candidate.provider.trim().length === 0)) {
    return { ok: false, error: "provider must be a non-empty string" };
  }
  const lookbackLimit = readOptionalNumber(candidate.lookbackLimit);
  if (lookbackLimit !== undefined && (!Number.isInteger(lookbackLimit) || lookbackLimit <= 0)) {
    return { ok: false, error: "lookbackLimit must be a positive integer" };
  }
  if (candidate.enabled !== undefined && typeof candidate.enabled !== "boolean") return { ok: false, error: "enabled must be a boolean" };
  if (candidate.notes !== undefined && typeof candidate.notes !== "string") return { ok: false, error: "notes must be a string" };
  return {
    ok: true,
    value: {
      symbol: candidate.symbol.trim(),
      timeframe: candidate.timeframe.trim(),
      provider: typeof candidate.provider === "string" ? candidate.provider.trim() : undefined,
      enabled: candidate.enabled,
      lookbackLimit,
      notes: typeof candidate.notes === "string" ? candidate.notes.trim() : undefined,
    },
  };
}

function parseStockMarketDataWatchlistPatchBody(body: unknown):
  | { ok: true; value: UpdateStockMarketDataWatchlistInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be an object" };
  const candidate = body as Record<string, unknown>;
  const value: UpdateStockMarketDataWatchlistInput = {};
  if (candidate.symbol !== undefined) {
    if (typeof candidate.symbol !== "string" || candidate.symbol.trim().length === 0) return { ok: false, error: "symbol must be a non-empty string" };
    value.symbol = candidate.symbol.trim();
  }
  if (candidate.timeframe !== undefined) {
    if (typeof candidate.timeframe !== "string" || candidate.timeframe.trim().length === 0) return { ok: false, error: "timeframe must be a non-empty string" };
    value.timeframe = candidate.timeframe.trim();
  }
  if (candidate.provider !== undefined) {
    if (typeof candidate.provider !== "string" || candidate.provider.trim().length === 0) return { ok: false, error: "provider must be a non-empty string" };
    value.provider = candidate.provider.trim();
  }
  if (candidate.enabled !== undefined) {
    if (typeof candidate.enabled !== "boolean") return { ok: false, error: "enabled must be a boolean" };
    value.enabled = candidate.enabled;
  }
  if (candidate.lookbackLimit !== undefined) {
    const lookbackLimit = readFiniteNumber(candidate.lookbackLimit);
    if (lookbackLimit === null || !Number.isInteger(lookbackLimit) || lookbackLimit <= 0) return { ok: false, error: "lookbackLimit must be a positive integer" };
    value.lookbackLimit = lookbackLimit;
  }
  if (candidate.notes !== undefined) {
    if (typeof candidate.notes !== "string") return { ok: false, error: "notes must be a string" };
    value.notes = candidate.notes.trim();
  }
  return { ok: true, value };
}

function parseStockBacktestBody(body: unknown):
  | { ok: true; value: RunStockBacktestInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be an object" };
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.symbol !== "string" || candidate.symbol.trim().length === 0) return { ok: false, error: "symbol is required" };
  if (typeof candidate.timeframe !== "string" || candidate.timeframe.trim().length === 0) return { ok: false, error: "timeframe is required" };
  if (candidate.strategyTag !== "breakout_momentum") return { ok: false, error: "strategyTag is invalid" };
  return {
    ok: true,
    value: {
      symbol: candidate.symbol.trim(),
      timeframe: candidate.timeframe.trim(),
      strategyTag: "breakout_momentum",
      lookbackBars: readOptionalNumber(candidate.lookbackBars),
      volumeLookbackBars: readOptionalNumber(candidate.volumeLookbackBars),
      takeProfitPct: readOptionalNumber(candidate.takeProfitPct),
      stopLossPct: readOptionalNumber(candidate.stopLossPct),
      maxHoldingBars: readOptionalNumber(candidate.maxHoldingBars),
      notional: readOptionalNumber(candidate.notional),
      feeBps: readOptionalNumber(candidate.feeBps),
      slippageBps: readOptionalNumber(candidate.slippageBps),
    },
  };
}

function readFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readPositiveNumber(value: unknown): number | null {
  const numberValue = readFiniteNumber(value);
  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function readOptionalNumber(value: unknown): number | undefined {
  return value === undefined || value === "" ? undefined : readFiniteNumber(value) ?? undefined;
}

function parseStockCandidateStatus(value: string | undefined): StockMarketCandidateStatus | undefined {
  return value === "watch" || value === "approved" || value === "rejected" || value === "converted_to_decision" ? value : undefined;
}

function parseStockTradeAction(value: string | undefined): StockTradeAction | undefined {
  const upper = value?.toUpperCase();
  return upper === "BUY" || upper === "SELL" || upper === "HOLD" || upper === "WATCH" || upper === "SKIP" ? upper : undefined;
}

function parseStockTradingRuleStatus(value: string | undefined): StockTradingRuleStatus | undefined {
  return value === "candidate" || value === "active" || value === "rejected" ? value : undefined;
}

function isStockResearchCategory(value: unknown): value is StockResearchCategory {
  return value === "news" || value === "earnings" || value === "disclosure" || value === "fundamental" || value === "macro" || value === "sector" || value === "operator_note";
}

function isStockResearchSentiment(value: unknown): value is StockResearchSentiment {
  return value === "positive" || value === "neutral" || value === "negative" || value === "mixed" || value === "unknown";
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
