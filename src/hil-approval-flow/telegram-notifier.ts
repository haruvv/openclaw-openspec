import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import sgMail from "@sendgrid/mail";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

export async function notifyHil(params: {
  targetId: string;
  domain: string;
  seoScore: number;
  approveUrl: string;
  rejectUrl: string;
}): Promise<void> {
  try {
    await withRetry(() => postTelegramMessage(params));
  } catch (err) {
    logger.error("Telegram notification failed, falling back to email", {
      error: err instanceof Error ? err.message : String(err),
    });
    await sendFallbackEmail(params);
  }
}

async function postTelegramMessage(params: {
  domain: string;
  seoScore: number;
  approveUrl: string;
  rejectUrl: string;
}): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: [
        "[HIL承認依頼]",
        `企業: ${params.domain}`,
        `SEOスコア: ${params.seoScore}/100`,
        "",
        `承認: ${params.approveUrl}`,
        `却下: ${params.rejectUrl}`,
      ].join("\n"),
      disable_web_page_preview: true,
    }),
  });

  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!json.ok) throw new Error(`Telegram API error: ${json.error}`);
  logger.info("Telegram HIL notification sent", { domain: params.domain });
}

async function sendFallbackEmail(params: {
  domain: string;
  seoScore: number;
  approveUrl: string;
  rejectUrl: string;
}): Promise<void> {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) return;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send({
    to: process.env.SENDGRID_FROM_EMAIL,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: `[HIL承認依頼] ${params.domain}`,
    text: `企業: ${params.domain}\nSEOスコア: ${params.seoScore}/100\n\n承認: ${params.approveUrl}\n却下: ${params.rejectUrl}`,
  });
  logger.info("Fallback HIL email sent", { domain: params.domain });
}
