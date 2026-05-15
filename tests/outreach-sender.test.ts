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
      payment_link_expires_at INTEGER, payment_reminder_sent_at INTEGER,
      created_at INTEGER, updated_at INTEGER
    );
  `);
  return { getDb: vi.fn().mockResolvedValue(db) };
});

import { sendOutreachEmail } from "../src/outreach-sender/sender.js";
import { getDb } from "../src/utils/db.js";
import sgMail from "@sendgrid/mail";
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
    vi.clearAllMocks();
  });

  it("returns skipped when contact email is missing", async () => {
    const result = await sendOutreachEmail({ ...base, contactEmail: undefined });
    expect(result).toEqual({ status: "skipped", reason: "missing_contact" });
  });

  it("returns skipped for duplicate domain within cooldown", async () => {
    const db = await getDb();
    db.prepare("INSERT INTO outreach_log (domain, sent_at) VALUES (?, ?)").run(
      "example.com",
      Date.now()
    );
    const result = await sendOutreachEmail(base, { humanApproved: true });
    expect(result).toEqual({ status: "skipped", reason: "duplicate" });
  });

  it("does not send email before human approval", async () => {
    const result = await sendOutreachEmail(base);
    expect(result).toEqual({ status: "skipped", reason: "pending_human_approval" });
    expect(sgMail.send).not.toHaveBeenCalled();
  });

  it("sends email and records log for new domain", async () => {
    const result = await sendOutreachEmail(base, { humanApproved: true });
    expect(result).toEqual({ status: "sent" });
    const db = await getDb();
    const row = db.prepare("SELECT * FROM outreach_log WHERE domain = ?").get("example.com");
    expect(row).toBeTruthy();
  });

  it("uses LLM audit outreach copy when available", async () => {
    const result = await sendOutreachEmail({
      ...base,
      llmRevenueAudit: {
        overallAssessment: "改善余地があります。",
        salesPriority: "medium",
        confidence: "high",
        businessImpactSummary: "問い合わせ前に離脱している可能性があります。",
        recommendedOffer: {
          name: "CTA改善",
          description: "問い合わせ導線を整えます。",
          estimatedPriceRange: "3万〜5万円",
          reason: "CTAが弱いためです。",
        },
        prioritizedFindings: [],
        outreach: {
          subject: "簡易診断のご共有について",
          firstEmail: "もし必要であれば要点だけ共有します。",
          followUpEmail: "先日の件で必要でしたらお送りします。",
        },
        caveats: [],
      },
    }, { humanApproved: true });

    expect(result).toEqual({ status: "sent" });
    expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
      subject: "簡易診断のご共有について",
      text: "もし必要であれば要点だけ共有します。",
    }));
  });
});
