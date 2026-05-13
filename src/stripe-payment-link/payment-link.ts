import Stripe from "stripe";
import sgMail from "@sendgrid/mail";
import { getDb } from "../utils/db.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const LINK_VALIDITY_DAYS = 30;
const REMINDER_DAYS_BEFORE = 7;

export async function createAndSendPaymentLink(targetId: string): Promise<string> {
  const db = await getDb();
  const row = db.prepare("SELECT * FROM targets WHERE id = ?").get(targetId) as TargetRow | undefined;
  if (!row) throw new Error(`Target not found: ${targetId}`);

  const expiresAt = Math.floor(Date.now() / 1000) + LINK_VALIDITY_DAYS * 86400;

  const product = await stripe.products.create({
    name: `SEO改善サービス初月費用 - ${row.domain}`,
    metadata: { targetId, domain: row.domain },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 50000,
    currency: "jpy",
  });

  const paymentLink = await withRetry(() =>
    stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { targetId, domain: row.domain },
      after_completion: {
        type: "redirect",
        redirect: { url: (process.env.HIL_APPROVAL_BASE_URL ?? "http://localhost:3000") + "/thank-you" },
      },
    })
  );

  db.prepare(
    "UPDATE targets SET payment_link_url = ?, payment_link_id = ?, status = 'payment_link_sent', updated_at = ? WHERE id = ?"
  ).run(paymentLink.url, paymentLink.id, Date.now(), targetId);

  await sendPaymentLinkEmail(row, paymentLink.url, expiresAt);
  await notifySlackPaymentSent(row.domain, paymentLink.url);

  logger.info("Payment link created and sent", { domain: row.domain, url: paymentLink.url });
  return paymentLink.url;
}

async function sendPaymentLinkEmail(
  target: TargetRow,
  linkUrl: string,
  expiresAt: number
): Promise<void> {
  if (!target.contact_email) return;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  const expiryDate = new Date(expiresAt * 1000).toLocaleDateString("ja-JP");
  await withRetry(() =>
    sgMail.send({
      to: target.contact_email!,
      from: { email: process.env.SENDGRID_FROM_EMAIL!, name: process.env.SENDGRID_FROM_NAME ?? "SEO Consultant" },
      subject: `【お申し込み】${target.domain} SEO改善サービスのお支払いページ`,
      text: `この度はご関心をいただきありがとうございます。\n\n下記リンクよりお申し込みください（有効期限: ${expiryDate}）：\n${linkUrl}`,
    })
  );
}

export async function sendPaymentReminders(): Promise<void> {
  const db = await getDb();
  const reminderCutoff = Date.now() + REMINDER_DAYS_BEFORE * 86400 * 1000;
  const rows = db
    .prepare(
      "SELECT * FROM targets WHERE status = 'payment_link_sent' AND updated_at < ?"
    )
    .all(reminderCutoff) as TargetRow[];

  for (const row of rows) {
    if (!row.contact_email || !row.payment_link_url) continue;
    const sentAgo = Date.now() - row.updated_at;
    const daysUntilExpiry = LINK_VALIDITY_DAYS - Math.floor(sentAgo / 86400 / 1000);
    if (daysUntilExpiry !== REMINDER_DAYS_BEFORE) continue;

    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    await sgMail.send({
      to: row.contact_email,
      from: { email: process.env.SENDGRID_FROM_EMAIL!, name: process.env.SENDGRID_FROM_NAME ?? "SEO Consultant" },
      subject: `【リマインド】お支払いリンクの有効期限は残り${daysUntilExpiry}日です`,
      text: `お支払いリンクの有効期限が${daysUntilExpiry}日後に迫っています。\n\n${row.payment_link_url}`,
    });
    logger.info("Payment reminder sent", { domain: row.domain });
  }
}

async function notifySlackPaymentSent(domain: string, linkUrl: string): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: process.env.SLACK_CHANNEL_ID,
      text: `Payment Link送付完了: \`${domain}\`\n${linkUrl}`,
    }),
  }).catch((err) => logger.error("Slack notify failed", { err }));
}

interface TargetRow {
  id: string;
  domain: string;
  contact_email?: string;
  payment_link_url?: string;
  payment_link_id?: string;
  updated_at: number;
}
