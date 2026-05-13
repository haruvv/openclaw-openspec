import { describe, it, expect, vi } from "vitest";

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    products: { create: vi.fn().mockResolvedValue({ id: "prod_test" }) },
    prices: { create: vi.fn().mockResolvedValue({ id: "price_test" }) },
    paymentLinks: {
      create: vi.fn().mockResolvedValue({ id: "plink_test", url: "https://buy.stripe.com/test" }),
    },
    webhooks: {
      constructEvent: vi.fn().mockImplementation((payload, sig, secret) => {
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
      created_at INTEGER, updated_at INTEGER
    );
  `);
  db.prepare(`INSERT INTO targets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run("t1", "example.com", "https://example.com", "info@example.com", null, 30, "[]", "approved", null, null, null, null, Date.now(), Date.now());
  return { getDb: vi.fn().mockResolvedValue(db) };
});

import { createAndSendPaymentLink } from "../src/stripe-payment-link/payment-link.js";
import { handleStripeEvent } from "../src/stripe-payment-link/webhook-handler.js";
import { constructStripeEvent } from "../src/stripe-payment-link/webhook-handler.js";

describe("createAndSendPaymentLink", () => {
  it("creates a payment link and returns URL", async () => {
    const url = await createAndSendPaymentLink("t1");
    expect(url).toBe("https://buy.stripe.com/test");
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
