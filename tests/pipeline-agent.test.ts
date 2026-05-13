import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{ statusCode: 202 }, {}]) },
}));

vi.mock("../src/hil-approval-flow/telegram-notifier.js", () => ({
  notifyHil: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/site-crawler/crawler.js", () => ({
  crawlBatch: vi.fn(),
}));

vi.mock("../src/proposal-generator/generator.js", () => ({
  generateProposal: vi.fn(),
}));

vi.mock("../src/proposal-generator/storage.js", () => ({
  saveProposalWithPdf: vi.fn(),
}));

vi.mock("../src/stripe-payment-link/payment-link.js", () => ({
  createAndSendPaymentLink: vi.fn(),
}));

vi.mock("../src/utils/db.js", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE outreach_log (domain TEXT, sent_at INTEGER);
    CREATE TABLE targets (
      id TEXT PRIMARY KEY, domain TEXT, url TEXT, contact_email TEXT, industry TEXT,
      seo_score INTEGER, diagnostics TEXT, status TEXT, proposal_path TEXT,
      hil_token TEXT, payment_link_url TEXT, payment_link_id TEXT,
      payment_link_expires_at INTEGER, payment_reminder_sent_at INTEGER,
      created_at INTEGER, updated_at INTEGER
    );
  `);
  return { getDb: vi.fn().mockResolvedValue(db) };
});

import { runSendStep } from "../src/pipeline/agent.js";
import { getDb } from "../src/utils/db.js";
import { notifyHil } from "../src/hil-approval-flow/telegram-notifier.js";

describe("runSendStep", () => {
  beforeEach(async () => {
    const db = await getDb();
    db.exec("DELETE FROM outreach_log; DELETE FROM targets;");
    vi.mocked(notifyHil).mockClear();
  });

  it("moves successfully sent outreach into HIL pending state", async () => {
    const db = await getDb();
    db.prepare(`INSERT INTO targets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        "t1",
        "example.com",
        "https://example.com",
        "info@example.com",
        null,
        30,
        "[]",
        "outreach_queued",
        null,
        null,
        null,
        null,
        null,
        null,
        Date.now(),
        Date.now()
      );

    await runSendStep();

    const row = db
      .prepare("SELECT status, hil_token FROM targets WHERE id = ?")
      .get("t1") as { status: string; hil_token: string };
    expect(row.status).toBe("hil_pending");
    expect(row.hil_token).toBeTruthy();
    expect(notifyHil).toHaveBeenCalledOnce();
  });
});
