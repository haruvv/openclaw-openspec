import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";

vi.mock("@sendgrid/mail", () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{ statusCode: 202 }, {}]) },
}));

vi.mock("../src/utils/db.js", () => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE outreach_log (domain TEXT, sent_at INTEGER);
    CREATE TABLE targets (
      id TEXT PRIMARY KEY, domain TEXT, url TEXT, contact_email TEXT, industry TEXT,
      seo_score INTEGER, diagnostics TEXT, status TEXT, proposal_path TEXT,
      hil_token TEXT, payment_link_url TEXT, payment_link_id TEXT,
      created_at INTEGER, updated_at INTEGER
    );
  `);
  return { getDb: vi.fn().mockResolvedValue(db) };
});

import { sendOutreachEmail } from "../src/outreach-sender/sender.js";
import { getDb } from "../src/utils/db.js";
import type { Target } from "../src/types/index.js";

const base: Target = {
  id: "t1",
  url: "https://example.com",
  domain: "example.com",
  contactEmail: "info@example.com",
  seoScore: 30,
  diagnostics: [],
  status: "outreach_queued",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("sendOutreachEmail", () => {
  beforeEach(async () => {
    const db = await getDb();
    db.exec("DELETE FROM outreach_log");
  });

  it("returns false when contact email is missing", async () => {
    const result = await sendOutreachEmail({ ...base, contactEmail: undefined });
    expect(result).toBe(false);
  });

  it("returns false for duplicate domain within cooldown", async () => {
    const db = await getDb();
    db.prepare("INSERT INTO outreach_log (domain, sent_at) VALUES (?, ?)").run(
      "example.com",
      Date.now()
    );
    const result = await sendOutreachEmail(base);
    expect(result).toBe(false);
  });

  it("sends email and records log for new domain", async () => {
    const result = await sendOutreachEmail(base);
    expect(result).toBe(true);
    const db = await getDb();
    const row = db.prepare("SELECT * FROM outreach_log WHERE domain = ?").get("example.com");
    expect(row).toBeTruthy();
  });
});
