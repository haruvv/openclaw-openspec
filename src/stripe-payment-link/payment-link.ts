import Stripe from "stripe";
import sgMail from "@sendgrid/mail";
import { getDb } from "../utils/db.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const LINK_VALIDITY_DAYS = 30;
const REMINDER_DAYS_BEFORE = 7;
const DAY_MS = 86400 * 1000;

export async function createAndSendPaymentLink(targetId: string): Promise<string> {
  const db = await getDb();
  const row = db.prepare("SELECT * FROM targets WHERE id = ?").get(targetId) as TargetRow | undefined;
  if (!row) throw new Error(`Target not found: ${targetId}`);

  const expiresAt = Date.now() + LINK_VALIDITY_DAYS * DAY_MS;

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
    `UPDATE targets
     SET payment_link_url = ?,
         payment_link_id = ?,
         payment_link_expires_at = ?,
         status = 'payment_link_sent',
         updated_at = ?
     WHERE id = ?`
  ).run(paymentLink.url, paymentLink.id, expiresAt, Date.now(), targetId);

  await sendPaymentLinkEmail(row, paymentLink.url, expiresAt);
  await notifyTelegramPaymentSent(row.domain, paymentLink.url);

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
  const expiryDate = new Date(expiresAt).toLocaleDateString("ja-JP");
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
  const reminderCutoff = Date.now() + REMINDER_DAYS_BEFORE * DAY_MS;
  const rows = db
    .prepare(
      `SELECT * FROM targets
       WHERE status = 'payment_link_sent'
         AND payment_link_expires_at IS NOT NULL
         AND payment_link_expires_at <= ?
         AND payment_link_expires_at > ?
         AND payment_reminder_sent_at IS NULL`
    )
    .all(reminderCutoff, Date.now()) as TargetRow[];

  for (const row of rows) {
    if (!row.contact_email || !row.payment_link_url) continue;
    if (!row.payment_link_expires_at) continue;
    const daysUntilExpiry = Math.ceil((row.payment_link_expires_at - Date.now()) / DAY_MS);

    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    await sgMail.send({
      to: row.contact_email,
      from: { email: process.env.SENDGRID_FROM_EMAIL!, name: process.env.SENDGRID_FROM_NAME ?? "SEO Consultant" },
      subject: `【リマインド】お支払いリンクの有効期限は残り${daysUntilExpiry}日です`,
      text: `お支払いリンクの有効期限が${daysUntilExpiry}日後に迫っています。\n\n${row.payment_link_url}`,
    });
    db.prepare(
      "UPDATE targets SET payment_reminder_sent_at = ?, updated_at = ? WHERE id = ?"
    ).run(Date.now(), Date.now(), row.id);
    logger.info("Payment reminder sent", { domain: row.domain });
  }
}

async function notifyTelegramPaymentSent(domain: string, linkUrl: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: `Payment Link送付完了: \`${domain}\`\n${linkUrl}`,
      disable_web_page_preview: true,
    }),
  }).catch((err) => logger.error("Telegram notify failed", { err }));
}

interface TargetRow {
  id: string;
  domain: string;
  contact_email?: string;
  payment_link_url?: string;
  payment_link_id?: string;
  payment_link_expires_at?: number;
  payment_reminder_sent_at?: number;
  updated_at: number;
}
