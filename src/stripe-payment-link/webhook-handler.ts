import Stripe from "stripe";
import { getDb } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { markPaymentLinkPaidByStripeId } from "../sales/repository.js";

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

  const obj = event.data.object as { metadata?: { targetId?: string; domain?: string }; payment_link?: string };
  if (obj.payment_link) {
    const paymentLink = await markPaymentLinkPaidByStripeId(obj.payment_link);
    if (paymentLink) {
      logger.info("Sales payment link marked paid", { paymentLinkId: paymentLink.id, domain: paymentLink.domain });
      await notifyTelegramPaid(paymentLink.domain);
      return;
    }
  }

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
  await notifyTelegramPaid(domain ?? targetId);
}

async function notifyTelegramPaid(domain: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: `:white_check_mark: 着金確認済み: \`${domain}\``,
    }),
  }).catch((err) => logger.error("Telegram paid notify failed", { err }));
}
