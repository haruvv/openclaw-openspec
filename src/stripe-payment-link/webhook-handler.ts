import Stripe from "stripe";
import { getDb } from "../utils/db.js";
import { logger } from "../utils/logger.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export function constructStripeEvent(payload: Buffer, signature: string): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, WEBHOOK_SECRET);
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "payment_intent.succeeded"
  ) {
    return;
  }

  const obj = event.data.object as { metadata?: { targetId?: string; domain?: string } };
  const targetId = obj.metadata?.targetId;
  const domain = obj.metadata?.domain;

  if (!targetId) {
    logger.warn("Stripe event missing targetId in metadata", { eventType: event.type });
    return;
  }

  const db = await getDb();
  db.prepare("UPDATE targets SET status = 'paid', updated_at = ? WHERE id = ?").run(
    Date.now(),
    targetId
  );

  logger.info("Payment confirmed", { targetId, domain });
  await notifySlackPaid(domain ?? targetId);
}

async function notifySlackPaid(domain: string): Promise<void> {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_CHANNEL_ID) return;
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: process.env.SLACK_CHANNEL_ID,
      text: `:white_check_mark: 着金確認済み: \`${domain}\``,
    }),
  }).catch((err) => logger.error("Slack paid notify failed", { err }));
}
