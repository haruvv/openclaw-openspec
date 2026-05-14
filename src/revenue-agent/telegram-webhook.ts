import type { Request, Response } from "express";
import { runRevenueAgent } from "./runner.js";
import { applySideEffectPolicy, sideEffectPolicyReason, validateSafeTargetUrl } from "./security.js";
import { logger } from "../utils/logger.js";

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat?: {
    id: number | string;
    type?: string;
  };
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
};

function isAllowedTelegramChat(chatId: number | string): boolean {
  const configured = process.env.TELEGRAM_CHAT_ID;
  if (!configured) return true;
  const allowed = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(String(chatId));
}

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"'）)]+/i);
  return match?.[0] ?? null;
}

function chunkTelegramText(text: string): string[] {
  const chunks: string[] = [];
  const limit = 3900;
  for (let index = 0; index < text.length; index += limit) {
    chunks.push(text.slice(index, index + limit));
  }
  return chunks.length > 0 ? chunks : [text];
}

async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN is not configured; skipping Telegram reply");
    return;
  }

  for (const chunk of chunkTelegramText(text)) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error("Telegram sendMessage failed", {
        status: response.status,
        body: body.slice(0, 500),
      });
    }
  }
}

function formatRevenueAgentReply(report: Awaited<ReturnType<typeof runRevenueAgent>>): string {
  const lines = [
    "RevenueAgent analysis complete.",
    "",
    `Status: ${report.status}`,
    `Target: ${report.targetUrl}`,
    typeof report.outputs.seoScore === "number" ? `SEO score: ${report.outputs.seoScore}` : undefined,
    typeof report.outputs.domain === "string" ? `Domain: ${report.outputs.domain}` : undefined,
    typeof report.outputs.proposalPath === "string" ? `Proposal: ${report.outputs.proposalPath}` : undefined,
  ].filter((line): line is string => Boolean(line));

  if (report.steps.length > 0) {
    lines.push("", "Steps:");
    for (const step of report.steps) {
      const reason = step.error ?? step.reason;
      lines.push(`- ${step.name}: ${step.status}${reason ? ` (${reason})` : ""}`);
    }
  }

  return lines.join("\n");
}

async function runTelegramRevenueAgent(update: TelegramUpdate): Promise<void> {
  const message = update.message ?? update.edited_message;
  const chatId = message?.chat?.id;
  const text = message?.text?.trim();

  if (!chatId || !text) return;

  if (!isAllowedTelegramChat(chatId)) {
    await sendTelegramMessage(chatId, "This Telegram chat is not authorized for RevenueAgentPlatform.");
    return;
  }

  const targetUrl = extractFirstUrl(text);
  if (!targetUrl) {
    await sendTelegramMessage(
      chatId,
      [
        "RevenueAgentPlatform is ready.",
        "",
        "Send a message that includes a target URL, for example:",
        "RevenueAgentで https://example.com を分析してください。",
      ].join("\n"),
    );
    return;
  }

  await sendTelegramMessage(chatId, `RevenueAgent analysis started: ${targetUrl}`);

  const safeUrl = await validateSafeTargetUrl(targetUrl);
  if (!safeUrl.ok) {
    await sendTelegramMessage(chatId, `RevenueAgent analysis failed: ${safeUrl.error}`);
    return;
  }

  try {
    const requested = { sendEmail: false, sendTelegram: false, createPaymentLink: false };
    const allowed = applySideEffectPolicy(requested);
    const report = await runRevenueAgent({
      targetUrl: safeUrl.url,
      sendEmail: allowed.sendEmail,
      sendTelegram: allowed.sendTelegram,
      createPaymentLink: allowed.createPaymentLink,
      sideEffectSkipReasons: {
        sendEmail: sideEffectPolicyReason("sendEmail"),
        sendTelegram: sideEffectPolicyReason("sendTelegram"),
        createPaymentLink: sideEffectPolicyReason("createPaymentLink"),
      },
    });

    await sendTelegramMessage(chatId, formatRevenueAgentReply(report));
  } catch (error) {
    logger.error("Telegram RevenueAgent run failed", { error });
    await sendTelegramMessage(
      chatId,
      `RevenueAgent analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function handleTelegramWebhook(req: Request, res: Response): Promise<void> {
  const update = req.body as TelegramUpdate;
  res.json({ ok: true });

  void runTelegramRevenueAgent(update).catch((error) => {
    logger.error("Telegram RevenueAgent webhook failed", { error });
  });
}
