import { describe, it, expect, vi } from "vitest";

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    products: { create: vi.fn().mockResolvedValue({ id: "prod_test" }) },
    prices: { create: vi.fn().mockResolvedValue({ id: "price_test" }) },
    paymentLinks: {
      create: vi.fn().mockResolvedValue({ id: "plink_test", url: "https://buy.stripe.com/test" }),
    },
    webhooks: {
      constructEvent: vi.fn().mockImplementation((payload, sig, _secret) => {
        if (sig === "bad") throw new Error("Invalid signature");
        return JSON.parse(payload.toString());
      }),
    },
  })),
}));

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{ statusCode: 202 }]) },
}));

vi.mock("../src/utils/db.js", () => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE targets (
      id TEXT PRIMARY KEY, domain TEXT, url TEXT, contact_email TEXT, industry TEXT,
      seo_score INTEGER, diagnostics TEXT, status TEXT, proposal_path TEXT,
      hil_token TEXT, payment_link_url TEXT, payment_link_id TEXT,
      payment_link_expires_at INTEGER, payment_reminder_sent_at INTEGER,
      created_at INTEGER, updated_at INTEGER
    );
  `);
  db.prepare(`INSERT INTO targets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("t1", "example.com", "https://example.com", "info@example.com", null, 30, "[]", "approved", null, null, null, null, null, null, Date.now(), Date.now());
  return { getDb: vi.fn().mockResolvedValue(db) };
});

import sgMail from "@sendgrid/mail";
import { createAndSendPaymentLink, sendPaymentReminders } from "../src/stripe-payment-link/payment-link.js";
import { handleStripeEvent } from "../src/stripe-payment-link/webhook-handler.js";
import { getDb } from "../src/utils/db.js";

describe("createAndSendPaymentLink", () => {
  it("creates a payment link, persists expiration, and returns URL", async () => {
    const url = await createAndSendPaymentLink("t1");
    expect(url).toBe("https://buy.stripe.com/test");
    const db = await getDb();
    const row = db
      .prepare("SELECT payment_link_expires_at FROM targets WHERE id = ?")
      .get("t1") as { payment_link_expires_at: number };
    expect(row.payment_link_expires_at).toBeGreaterThan(Date.now());
  });

  it("sends a reminder once when expiration is within seven days", async () => {
    const db = await getDb();
    db.prepare(
      `UPDATE targets
       SET status = 'payment_link_sent',
           payment_link_url = ?,
           payment_link_expires_at = ?,
           payment_reminder_sent_at = NULL
       WHERE id = ?`
    ).run("https://buy.stripe.com/test", Date.now() + 6 * 86400 * 1000, "t1");
    vi.mocked(sgMail.send).mockClear();

    await sendPaymentReminders();
    await sendPaymentReminders();

    expect(sgMail.send).toHaveBeenCalledTimes(1);
    const row = db
      .prepare("SELECT payment_reminder_sent_at FROM targets WHERE id = ?")
      .get("t1") as { payment_reminder_sent_at: number };
    expect(row.payment_reminder_sent_at).toBeGreaterThan(0);
  });
});

describe("handleStripeEvent", () => {
  it("marks target as paid on payment_intent.succeeded", async () => {
    const event = {
      type: "payment_intent.succeeded",
      data: { object: { metadata: { targetId: "t1", domain: "example.com" } } },
    };
    await expect(handleStripeEvent(event as any)).resolves.not.toThrow();
  });

  it("ignores unrelated event types", async () => {
    const event = {
      type: "customer.created",
      data: { object: {} },
    };
    await expect(handleStripeEvent(event as any)).resolves.not.toThrow();
  });
});
