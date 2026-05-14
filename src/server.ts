import "dotenv/config";
import express from "express";
import { handleApprove, handleReject } from "./hil-approval-flow/approval-handler.js";
import { constructStripeEvent, handleStripeEvent } from "./stripe-payment-link/webhook-handler.js";
import { runHilStep, runPaymentStep } from "./pipeline/agent.js";
import { getTarget } from "./pipeline/state.js";
import { checkHilTimeouts } from "./hil-approval-flow/timeout-watcher.js";
import { sendPaymentReminders } from "./stripe-payment-link/payment-link.js";
import { logger } from "./utils/logger.js";
import { handleRevenueAgentRun } from "./revenue-agent/http.js";
import { handleTelegramWebhook } from "./revenue-agent/telegram-webhook.js";
import { adminApiRouter, adminAssetsRouter, adminRouter } from "./admin/routes.js";
import { getStorageConfig } from "./storage/index.js";

export const app = express();

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      res.status(400).send("Missing stripe-signature");
      return;
    }
    try {
      const event = constructStripeEvent(req.body as Buffer, sig);
      await handleStripeEvent(event);
      res.json({ received: true });
    } catch (err) {
      logger.error("Stripe webhook error", { err });
      res.status(400).send("Webhook error");
    }
  }
);

app.use(express.json());

app.post("/api/revenue-agent/run", async (req, res) => {
  await handleRevenueAgentRun(req, res);
});

app.post("/telegram/webhook", async (req, res) => {
  await handleTelegramWebhook(req, res);
});

app.use("/api/admin", adminApiRouter);
app.use("/admin/assets", adminAssetsRouter);
app.use("/admin", adminRouter);
app.use("/sites", (req, res) => {
  const suffix = req.path === "/" ? "" : req.path;
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(301, `/admin/seo-sales/sites${suffix}${query}`);
});

app.get("/hil/approve", async (req, res) => {
  const { targetId, token } = req.query as Record<string, string>;
  const ok = await handleApprove(targetId, token);
  if (!ok) { res.status(400).send("Invalid token"); return; }

  const target = await getTarget(targetId);
  if (target) await runPaymentStep();

  res.send("<h1>承認しました。Payment Linkを送付します。</h1>");
});

app.get("/hil/reject", async (req, res) => {
  const { targetId, token } = req.query as Record<string, string>;
  const ok = await handleReject(targetId, token);
  if (!ok) { res.status(400).send("Invalid token"); return; }
  res.send("<h1>却下しました。</h1>");
});

app.get("/thank-you", (_req, res) => {
  res.send("<h1>お申し込みありがとうございます。</h1>");
});

app.get("/health", (_req, res) => {
  const storage = getStorageConfig();
  res.json({
    status: "ok",
    storage: {
      mode: storage.mode,
      durableConfigured: storage.mode === "durable-http",
    },
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = Number(process.env.PORT ?? 3000);
  app.listen(PORT, () => logger.info(`Server listening on :${PORT}`));

  setInterval(async () => {
    await checkHilTimeouts().catch((e) => logger.error("Timeout check failed", { e }));
    await sendPaymentReminders().catch((e) => logger.error("Reminder check failed", { e }));
  }, 60 * 60 * 1000);
}
