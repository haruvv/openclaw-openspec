import { randomUUID } from "node:crypto";
import { getDb } from "../utils/db.js";
import { DurableHttpStorageClient, getStorageConfig } from "../storage/index.js";
import type {
  CreateOutreachMessageInput,
  CreatePaymentLinkInput,
  SalesActions,
  SalesOutreachMessage,
  SalesOutreachStatus,
  SalesPaymentLinkRecord,
  SalesPaymentLinkStatus,
} from "./types.js";

type JsonObject = Record<string, unknown>;

type OutreachRow = {
  id: string;
  run_id: string;
  site_id: string | null;
  snapshot_id: string | null;
  target_url: string;
  domain: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  status: SalesOutreachStatus;
  reviewed_at: number | null;
  sent_at: number | null;
  error: string | null;
  metadata_json: string;
  created_at: number;
  updated_at: number;
};

type PaymentLinkRow = {
  id: string;
  run_id: string;
  site_id: string | null;
  outreach_message_id: string | null;
  domain: string;
  recipient_email: string | null;
  amount_jpy: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stripe_payment_link_id: string | null;
  payment_link_url: string | null;
  status: SalesPaymentLinkStatus;
  expires_at: number | null;
  sent_at: number | null;
  error: string | null;
  metadata_json: string;
  created_at: number;
  updated_at: number;
};

type SiteContextRow = {
  site_id: string;
  snapshot_id: string;
};

export async function getSalesActionsForRun(runId: string): Promise<SalesActions> {
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<OutreachRow | PaymentLinkRow>([
      { sql: "SELECT * FROM sales_outreach_messages WHERE run_id = ? ORDER BY created_at DESC", params: [runId] },
      { sql: "SELECT * FROM sales_payment_links WHERE run_id = ? ORDER BY created_at DESC", params: [runId] },
    ]);
    return {
      outreachMessages: ((results[0]?.results ?? []) as OutreachRow[]).map(mapOutreachRow),
      paymentLinks: ((results[1]?.results ?? []) as PaymentLinkRow[]).map(mapPaymentLinkRow),
    };
  }

  const db = await getDb();
  const outreach = db
    .prepare("SELECT * FROM sales_outreach_messages WHERE run_id = ? ORDER BY created_at DESC")
    .all(runId) as OutreachRow[];
  const paymentLinks = db
    .prepare("SELECT * FROM sales_payment_links WHERE run_id = ? ORDER BY created_at DESC")
    .all(runId) as PaymentLinkRow[];
  return {
    outreachMessages: outreach.map(mapOutreachRow),
    paymentLinks: paymentLinks.map(mapPaymentLinkRow),
  };
}

export async function getSiteContextForRun(runId: string): Promise<{ siteId?: string; snapshotId?: string }> {
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<SiteContextRow>([
      {
        sql: `SELECT site_id, id AS snapshot_id
          FROM site_snapshots
          WHERE run_id = ?
          ORDER BY created_at DESC
          LIMIT 1`,
        params: [runId],
      },
    ]);
    const row = results[0]?.results?.[0];
    return { siteId: row?.site_id, snapshotId: row?.snapshot_id };
  }

  const db = await getDb();
  const row = db.prepare(
    `SELECT site_id, id AS snapshot_id
     FROM site_snapshots
     WHERE run_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
  ).get(runId) as SiteContextRow | undefined;
  return { siteId: row?.site_id, snapshotId: row?.snapshot_id };
}

export async function hasRecentSentOutreach(domain: string, cooldownDays = 30): Promise<boolean> {
  const cutoff = Date.now() - cooldownDays * 24 * 60 * 60 * 1000;
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<{ found: number }>([
      {
        sql: `SELECT 1 AS found
          FROM sales_outreach_messages
          WHERE domain = ? AND status = 'sent' AND sent_at IS NOT NULL AND sent_at > ?
          LIMIT 1`,
        params: [domain, cutoff],
      },
    ]);
    return Boolean(results[0]?.results?.[0]);
  }

  const db = await getDb();
  const row = db.prepare(
    `SELECT 1 AS found
     FROM sales_outreach_messages
     WHERE domain = ? AND status = 'sent' AND sent_at IS NOT NULL AND sent_at > ?
     LIMIT 1`,
  ).get(domain, cutoff);
  return Boolean(row);
}

export async function createOutreachMessage(input: CreateOutreachMessageInput): Promise<SalesOutreachMessage> {
  const id = randomUUID();
  const now = Date.now();
  const row = toOutreachRow({ id, now, input });
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{ sql: insertOutreachSql(), params: outreachParams(row) }]);
    return mapOutreachRow(row);
  }

  const db = await getDb();
  db.prepare(insertOutreachSql()).run(...outreachParams(row));
  return mapOutreachRow(row);
}

export async function createPaymentLinkRecord(input: CreatePaymentLinkInput): Promise<SalesPaymentLinkRecord> {
  const id = randomUUID();
  const now = Date.now();
  const row = toPaymentLinkRow({ id, now, input });
  const durable = getDurableClient();
  if (durable) {
    await durable.executeSql([{ sql: insertPaymentSql(), params: paymentParams(row) }]);
    return mapPaymentLinkRow(row);
  }

  const db = await getDb();
  db.prepare(insertPaymentSql()).run(...paymentParams(row));
  return mapPaymentLinkRow(row);
}

export async function markPaymentLinkSent(id: string, sentAt: Date): Promise<SalesPaymentLinkRecord> {
  const now = Date.now();
  const sentAtMs = sentAt.getTime();
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<PaymentLinkRow>([
      {
        sql: "UPDATE sales_payment_links SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?",
        params: [sentAtMs, now, id],
      },
      { sql: "SELECT * FROM sales_payment_links WHERE id = ?", params: [id] },
    ]);
    const row = results[1]?.results?.[0];
    if (!row) throw new Error("payment link record not found after sent update");
    return mapPaymentLinkRow(row);
  }

  const db = await getDb();
  db.prepare("UPDATE sales_payment_links SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?")
    .run(sentAtMs, now, id);
  const row = db.prepare("SELECT * FROM sales_payment_links WHERE id = ?").get(id) as PaymentLinkRow | undefined;
  if (!row) throw new Error("payment link record not found after sent update");
  return mapPaymentLinkRow(row);
}

export async function markPaymentLinkFailed(id: string, error: string): Promise<SalesPaymentLinkRecord> {
  const now = Date.now();
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<PaymentLinkRow>([
      {
        sql: "UPDATE sales_payment_links SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
        params: [error, now, id],
      },
      { sql: "SELECT * FROM sales_payment_links WHERE id = ?", params: [id] },
    ]);
    const row = results[1]?.results?.[0];
    if (!row) throw new Error("payment link record not found after failed update");
    return mapPaymentLinkRow(row);
  }

  const db = await getDb();
  db.prepare("UPDATE sales_payment_links SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
    .run(error, now, id);
  const row = db.prepare("SELECT * FROM sales_payment_links WHERE id = ?").get(id) as PaymentLinkRow | undefined;
  if (!row) throw new Error("payment link record not found after failed update");
  return mapPaymentLinkRow(row);
}

export async function markPaymentLinkPaidByStripeId(stripePaymentLinkId: string): Promise<SalesPaymentLinkRecord | null> {
  const now = Date.now();
  const durable = getDurableClient();
  if (durable) {
    const results = await durable.executeSql<PaymentLinkRow>([
      {
        sql: "UPDATE sales_payment_links SET status = 'paid', updated_at = ? WHERE stripe_payment_link_id = ?",
        params: [now, stripePaymentLinkId],
      },
      { sql: "SELECT * FROM sales_payment_links WHERE stripe_payment_link_id = ?", params: [stripePaymentLinkId] },
    ]);
    const row = results[1]?.results?.[0];
    return row ? mapPaymentLinkRow(row) : null;
  }

  const db = await getDb();
  db.prepare("UPDATE sales_payment_links SET status = 'paid', updated_at = ? WHERE stripe_payment_link_id = ?")
    .run(now, stripePaymentLinkId);
  const row = db.prepare("SELECT * FROM sales_payment_links WHERE stripe_payment_link_id = ?").get(stripePaymentLinkId) as PaymentLinkRow | undefined;
  return row ? mapPaymentLinkRow(row) : null;
}

function toOutreachRow({ id, now, input }: { id: string; now: number; input: CreateOutreachMessageInput }): OutreachRow {
  return {
    id,
    run_id: input.runId,
    site_id: input.siteId ?? null,
    snapshot_id: input.snapshotId ?? null,
    target_url: input.targetUrl,
    domain: input.domain,
    recipient_email: input.recipientEmail,
    subject: input.subject,
    body_text: input.bodyText,
    status: input.status,
    reviewed_at: input.reviewedAt?.getTime() ?? null,
    sent_at: input.sentAt?.getTime() ?? null,
    error: input.error ?? null,
    metadata_json: json(input.metadata ?? {}),
    created_at: now,
    updated_at: now,
  };
}

function toPaymentLinkRow({ id, now, input }: { id: string; now: number; input: CreatePaymentLinkInput }): PaymentLinkRow {
  return {
    id,
    run_id: input.runId,
    site_id: input.siteId ?? null,
    outreach_message_id: input.outreachMessageId ?? null,
    domain: input.domain,
    recipient_email: input.recipientEmail ?? null,
    amount_jpy: input.amountJpy,
    stripe_product_id: input.stripeProductId ?? null,
    stripe_price_id: input.stripePriceId ?? null,
    stripe_payment_link_id: input.stripePaymentLinkId ?? null,
    payment_link_url: input.paymentLinkUrl ?? null,
    status: input.status,
    expires_at: input.expiresAt?.getTime() ?? null,
    sent_at: input.sentAt?.getTime() ?? null,
    error: input.error ?? null,
    metadata_json: json(input.metadata ?? {}),
    created_at: now,
    updated_at: now,
  };
}

function insertOutreachSql(): string {
  return `INSERT INTO sales_outreach_messages (
    id, run_id, site_id, snapshot_id, target_url, domain, recipient_email, subject,
    body_text, status, reviewed_at, sent_at, error, metadata_json, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
}

function outreachParams(row: OutreachRow): unknown[] {
  return [
    row.id,
    row.run_id,
    row.site_id,
    row.snapshot_id,
    row.target_url,
    row.domain,
    row.recipient_email,
    row.subject,
    row.body_text,
    row.status,
    row.reviewed_at,
    row.sent_at,
    row.error,
    row.metadata_json,
    row.created_at,
    row.updated_at,
  ];
}

function insertPaymentSql(): string {
  return `INSERT INTO sales_payment_links (
    id, run_id, site_id, outreach_message_id, domain, recipient_email, amount_jpy,
    stripe_product_id, stripe_price_id, stripe_payment_link_id, payment_link_url,
    status, expires_at, sent_at, error, metadata_json, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
}

function paymentParams(row: PaymentLinkRow): unknown[] {
  return [
    row.id,
    row.run_id,
    row.site_id,
    row.outreach_message_id,
    row.domain,
    row.recipient_email,
    row.amount_jpy,
    row.stripe_product_id,
    row.stripe_price_id,
    row.stripe_payment_link_id,
    row.payment_link_url,
    row.status,
    row.expires_at,
    row.sent_at,
    row.error,
    row.metadata_json,
    row.created_at,
    row.updated_at,
  ];
}

function mapOutreachRow(row: OutreachRow): SalesOutreachMessage {
  return {
    id: row.id,
    runId: row.run_id,
    siteId: row.site_id ?? undefined,
    snapshotId: row.snapshot_id ?? undefined,
    targetUrl: row.target_url,
    domain: row.domain,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    bodyText: row.body_text,
    status: row.status,
    reviewedAt: date(row.reviewed_at),
    sentAt: date(row.sent_at),
    error: row.error ?? undefined,
    metadata: parseJson(row.metadata_json),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapPaymentLinkRow(row: PaymentLinkRow): SalesPaymentLinkRecord {
  return {
    id: row.id,
    runId: row.run_id,
    siteId: row.site_id ?? undefined,
    outreachMessageId: row.outreach_message_id ?? undefined,
    domain: row.domain,
    recipientEmail: row.recipient_email ?? undefined,
    amountJpy: row.amount_jpy,
    stripeProductId: row.stripe_product_id ?? undefined,
    stripePriceId: row.stripe_price_id ?? undefined,
    stripePaymentLinkId: row.stripe_payment_link_id ?? undefined,
    paymentLinkUrl: row.payment_link_url ?? undefined,
    status: row.status,
    expiresAt: date(row.expires_at),
    sentAt: date(row.sent_at),
    error: row.error ?? undefined,
    metadata: parseJson(row.metadata_json),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function date(value: number | null): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

function json(value: JsonObject): string {
  return JSON.stringify(value);
}

function parseJson(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
}

function getDurableClient(): DurableHttpStorageClient | null {
  const config = getStorageConfig();
  if (config.mode !== "durable-http" || !config.durableHttp) return null;
  return new DurableHttpStorageClient({ config: config.durableHttp });
}
