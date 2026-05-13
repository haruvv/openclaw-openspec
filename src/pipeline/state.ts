import { getDb } from "../utils/db.js";
import type { Target } from "../types/index.js";
import type Database from "better-sqlite3";

interface TargetRow {
  id: string;
  domain: string;
  url: string;
  contact_email?: string;
  industry?: string;
  seo_score: number;
  diagnostics: string;
  status: string;
  proposal_path?: string;
  hil_token?: string;
  payment_link_url?: string;
  payment_link_id?: string;
  payment_link_expires_at?: number;
  payment_reminder_sent_at?: number;
  created_at: number;
  updated_at: number;
}

export async function saveTarget(target: Target): Promise<void> {
  const db = await getDb();
  db.prepare(`
    INSERT OR REPLACE INTO targets
      (id, domain, url, contact_email, industry, seo_score, diagnostics, status,
       proposal_path, hil_token, payment_link_url, payment_link_id,
       payment_link_expires_at, payment_reminder_sent_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    target.id,
    target.domain,
    target.url,
    target.contactEmail ?? null,
    target.industry ?? null,
    target.seoScore,
    JSON.stringify(target.diagnostics),
    target.status,
    target.proposalPath ?? null,
    target.hilToken ?? null,
    target.paymentLinkUrl ?? null,
    target.paymentLinkId ?? null,
    target.paymentLinkExpiresAt ?? null,
    target.paymentReminderSentAt ?? null,
    target.createdAt,
    target.updatedAt
  );
}

export async function getTarget(id: string): Promise<Target | null> {
  const db = await getDb();
  const row = db.prepare("SELECT * FROM targets WHERE id = ?").get(id) as TargetRow | undefined;
  return row ? rowToTarget(row) : null;
}

export async function getTargetsByStatus(status: Target["status"]): Promise<Target[]> {
  const db = await getDb();
  const rows = db.prepare("SELECT * FROM targets WHERE status = ?").all(status) as TargetRow[];
  return rows.map(rowToTarget);
}

function rowToTarget(row: TargetRow): Target {
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    contactEmail: row.contact_email,
    industry: row.industry,
    seoScore: row.seo_score,
    diagnostics: JSON.parse(row.diagnostics),
    status: row.status as Target["status"],
    proposalPath: row.proposal_path,
    hilToken: row.hil_token,
    paymentLinkUrl: row.payment_link_url,
    paymentLinkId: row.payment_link_id,
    paymentLinkExpiresAt: row.payment_link_expires_at,
    paymentReminderSentAt: row.payment_reminder_sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
