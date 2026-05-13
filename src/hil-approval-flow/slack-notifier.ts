import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import sgMail from "@sendgrid/mail";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN!;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID!;

export async function notifyHil(params: {
  targetId: string;
  domain: string;
  seoScore: number;
  approveUrl: string;
  rejectUrl: string;
}): Promise<void> {
  try {
    await withRetry(() => postSlackMessage(params));
  } catch (err) {
    logger.error("Slack notification failed, falling back to email", {
      error: err instanceof Error ? err.message : String(err),
    });
    await sendFallbackEmail(params);
  }
}

async function postSlackMessage(params: {
  domain: string;
  seoScore: number;
  approveUrl: string;
  rejectUrl: string;
}): Promise<void> {
  const body = {
    channel: SLACK_CHANNEL_ID,
    text: `[HIL承認依頼] ${params.domain}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*HIL承認依頼*\n企業: \`${params.domain}\`\nSEOスコア: *${params.seoScore}/100*`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "承認" },
            style: "primary",
            url: params.approveUrl,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "却下" },
            style: "danger",
            url: params.rejectUrl,
          },
        ],
      },
    ],
  };

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as { ok: boolean; error?: string };
  if (!json.ok) throw new Error(`Slack API error: ${json.error}`);
  logger.info("Slack HIL notification sent", { domain: params.domain });
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
