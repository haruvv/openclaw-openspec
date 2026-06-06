import { randomUUID } from "node:crypto";
import { getSqliteDb } from "../storage/sqlite.js";

export type SuppressionKind = "email" | "domain";

export interface ContactSuppression {
  id: string;
  kind: SuppressionKind;
  value: string;
  reason: string;
  source: string;
  createdAt: number;
}

export async function addContactSuppression(input: {
  kind: SuppressionKind;
  value: string;
  reason: string;
  source?: string;
  createdAt?: number;
}): Promise<ContactSuppression> {
  const now = input.createdAt ?? Date.now();
  const row: ContactSuppression = {
    id: randomUUID(),
    kind: input.kind,
    value: normalizeSuppressionValue(input.kind, input.value),
    reason: input.reason,
    source: input.source ?? "manual",
    createdAt: now,
  };
  const db = await getSqliteDb();
  db.prepare(`
    INSERT INTO contact_suppressions (id, kind, value, reason, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(kind, value) DO UPDATE SET
      reason = excluded.reason,
      source = excluded.source,
      created_at = excluded.created_at
  `).run(row.id, row.kind, row.value, row.reason, row.source, row.createdAt);
  return row;
}

export async function isContactSuppressed(input: { email?: string; domain?: string }): Promise<{ suppressed: boolean; reason?: string; kind?: SuppressionKind; value?: string }> {
  const email = input.email ? normalizeSuppressionValue("email", input.email) : undefined;
  const domain = input.domain ? normalizeSuppressionValue("domain", input.domain) : email?.split("@")[1];
  const db = await getSqliteDb();
  const checks = [
    email ? { kind: "email" as const, value: email } : null,
    domain ? { kind: "domain" as const, value: domain } : null,
  ].filter((item): item is { kind: SuppressionKind; value: string } => item !== null);

  for (const check of checks) {
    const row = db
      .prepare("SELECT kind, value, reason FROM contact_suppressions WHERE kind = ? AND value = ?")
      .get(check.kind, check.value) as { kind: SuppressionKind; value: string; reason: string } | undefined;
    if (row) return { suppressed: true, kind: row.kind, value: row.value, reason: row.reason };
  }
  return { suppressed: false };
}

export async function listContactSuppressions(limit = 100): Promise<ContactSuppression[]> {
  const db = await getSqliteDb();
  const rows = db.prepare(`
    SELECT id, kind, value, reason, source, created_at
    FROM contact_suppressions
    ORDER BY created_at DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(limit, 500))) as Array<{
    id: string;
    kind: SuppressionKind;
    value: string;
    reason: string;
    source: string;
    created_at: number;
  }>;
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    value: row.value,
    reason: row.reason,
    source: row.source,
    createdAt: row.created_at,
  }));
}

function normalizeSuppressionValue(kind: SuppressionKind, value: string): string {
  const normalized = value.trim().toLowerCase();
  if (kind === "email") return normalized;
  return normalized.replace(/^https?:\/\//, "").split("/")[0]?.replace(/^www\./, "") ?? normalized;
}
