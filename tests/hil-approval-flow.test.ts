import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";

vi.mock("../src/utils/db.js", () => {
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
    .run("t1", "example.com", "https://example.com", null, null, 30, "[]", "outreach_sent", null, null, null, null, null, null, Date.now(), Date.now());
  return { getDb: vi.fn().mockResolvedValue(db) };
});

import { handleApprove, handleReject, isAutoReply } from "../src/hil-approval-flow/approval-handler.js";
import { generateHilToken, verifyHilToken } from "../src/hil-approval-flow/token.js";

describe("HIL token", () => {
  it("round-trips correctly", () => {
    const token = generateHilToken("t1");
    expect(verifyHilToken(token, "t1")).toBe(true);
  });

  it("rejects wrong targetId", () => {
    const token = generateHilToken("t1");
    expect(verifyHilToken(token, "t2")).toBe(false);
  });

  it("rejects tampered token", () => {
    expect(verifyHilToken("tampered-token", "t1")).toBe(false);
  });
});

describe("handleApprove", () => {
  it("updates status to approved for valid token", async () => {
    const token = generateHilToken("t1");
    const ok = await handleApprove("t1", token);
    expect(ok).toBe(true);
  });

  it("returns false for invalid token", async () => {
    const ok = await handleApprove("t1", "bad-token");
    expect(ok).toBe(false);
  });
});

describe("handleReject", () => {
  it("updates status to rejected for valid token", async () => {
    const token = generateHilToken("t1");
    const ok = await handleReject("t1", token);
    expect(ok).toBe(true);
  });
});

describe("isAutoReply", () => {
  it("detects Japanese auto-reply patterns", () => {
    expect(isAutoReply("自動返信メールです", "")).toBe(true);
    expect(isAutoReply("不在のためお返事できません", "")).toBe(true);
  });

  it("detects English auto-reply patterns", () => {
    expect(isAutoReply("Out of Office", "")).toBe(true);
    expect(isAutoReply("Auto-Reply: I am on vacation", "")).toBe(true);
  });

  it("does not flag normal replies", () => {
    expect(isAutoReply("ご提案ありがとうございます", "興味があります")).toBe(false);
  });
});
