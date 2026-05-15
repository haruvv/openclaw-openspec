import Database from "better-sqlite3";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { getStorageConfig } from "./config.js";

let _db: Database.Database | null = null;

export async function getSqliteDb(): Promise<Database.Database> {
  if (_db) return _db;
  const dbPath = getStorageConfig().sqliteDbPath;
  await mkdir(dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  initSqliteSchema(_db);
  return _db;
}

export function resetSqliteDb(): void {
  _db = null;
}

export function initSqliteSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      url TEXT NOT NULL,
      contact_email TEXT,
      industry TEXT,
      seo_score INTEGER NOT NULL,
      diagnostics TEXT NOT NULL,
      opportunity_score INTEGER,
      opportunity_findings TEXT,
      status TEXT NOT NULL,
      proposal_path TEXT,
      hil_token TEXT,
      payment_link_url TEXT,
      payment_link_id TEXT,
      payment_link_expires_at INTEGER,
      payment_reminder_sent_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outreach_log (
      domain TEXT NOT NULL,
      sent_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_outreach_log_domain ON outreach_log(domain);
    CREATE INDEX IF NOT EXISTS idx_outreach_log_sent_at ON outreach_log(sent_at);
    CREATE INDEX IF NOT EXISTS idx_targets_status ON targets(status);

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      agent_type TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      input_json TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      error TEXT,
      metadata_json TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_run_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      reason TEXT,
      error TEXT,
      details_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_artifacts (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      path_or_url TEXT,
      content_text TEXT,
      body_storage TEXT NOT NULL DEFAULT 'inline',
      object_key TEXT,
      content_type TEXT,
      byte_size INTEGER,
      metadata_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
    CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run_id ON agent_run_steps(run_id);
    CREATE INDEX IF NOT EXISTS idx_agent_artifacts_run_id ON agent_artifacts(run_id);

    CREATE TABLE IF NOT EXISTS analyzed_sites (
      id TEXT PRIMARY KEY,
      normalized_url TEXT NOT NULL UNIQUE,
      display_url TEXT NOT NULL,
      domain TEXT NOT NULL,
      latest_status TEXT NOT NULL,
      latest_seo_score INTEGER,
      latest_opportunity_score INTEGER,
      latest_run_id TEXT,
      latest_snapshot_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_snapshots (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      target_url TEXT NOT NULL,
      domain TEXT NOT NULL,
      status TEXT NOT NULL,
      seo_score INTEGER,
      opportunity_score INTEGER,
      opportunity_findings_json TEXT NOT NULL DEFAULT '[]',
      diagnostics_json TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (site_id) REFERENCES analyzed_sites(id) ON DELETE CASCADE,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS site_proposals (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      snapshot_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      label TEXT NOT NULL,
      path_or_url TEXT,
      content_text TEXT,
      body_storage TEXT NOT NULL DEFAULT 'inline',
      object_key TEXT,
      content_type TEXT,
      byte_size INTEGER,
      metadata_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (site_id) REFERENCES analyzed_sites(id) ON DELETE CASCADE,
      FOREIGN KEY (snapshot_id) REFERENCES site_snapshots(id) ON DELETE CASCADE,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analyzed_sites_updated_at ON analyzed_sites(updated_at);
    CREATE INDEX IF NOT EXISTS idx_analyzed_sites_domain ON analyzed_sites(domain);
    CREATE INDEX IF NOT EXISTS idx_site_snapshots_site_created ON site_snapshots(site_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_site_snapshots_run_id ON site_snapshots(run_id);
    CREATE INDEX IF NOT EXISTS idx_site_proposals_site_created ON site_proposals(site_id, created_at);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_outreach_messages (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      site_id TEXT,
      snapshot_id TEXT,
      target_url TEXT NOT NULL,
      domain TEXT NOT NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_text TEXT NOT NULL,
      status TEXT NOT NULL,
      reviewed_at INTEGER,
      sent_at INTEGER,
      error TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (site_id) REFERENCES analyzed_sites(id) ON DELETE SET NULL,
      FOREIGN KEY (snapshot_id) REFERENCES site_snapshots(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sales_outreach_run_id ON sales_outreach_messages(run_id);
    CREATE INDEX IF NOT EXISTS idx_sales_outreach_site_id ON sales_outreach_messages(site_id);
    CREATE INDEX IF NOT EXISTS idx_sales_outreach_domain ON sales_outreach_messages(domain);
    CREATE INDEX IF NOT EXISTS idx_sales_outreach_status ON sales_outreach_messages(status);
    CREATE INDEX IF NOT EXISTS idx_sales_outreach_sent_at ON sales_outreach_messages(sent_at);
    CREATE INDEX IF NOT EXISTS idx_sales_outreach_created_at ON sales_outreach_messages(created_at);

    CREATE TABLE IF NOT EXISTS sales_payment_links (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      site_id TEXT,
      outreach_message_id TEXT,
      domain TEXT NOT NULL,
      recipient_email TEXT,
      amount_jpy INTEGER NOT NULL,
      stripe_product_id TEXT,
      stripe_price_id TEXT,
      stripe_payment_link_id TEXT,
      payment_link_url TEXT,
      status TEXT NOT NULL,
      expires_at INTEGER,
      sent_at INTEGER,
      error TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (site_id) REFERENCES analyzed_sites(id) ON DELETE SET NULL,
      FOREIGN KEY (outreach_message_id) REFERENCES sales_outreach_messages(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sales_payment_run_id ON sales_payment_links(run_id);
    CREATE INDEX IF NOT EXISTS idx_sales_payment_site_id ON sales_payment_links(site_id);
    CREATE INDEX IF NOT EXISTS idx_sales_payment_domain ON sales_payment_links(domain);
    CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales_payment_links(status);
    CREATE INDEX IF NOT EXISTS idx_sales_payment_created_at ON sales_payment_links(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_payment_link_id ON sales_payment_links(stripe_payment_link_id);
  `);
  ensureColumn(db, "targets", "payment_link_expires_at", "INTEGER");
  ensureColumn(db, "targets", "payment_reminder_sent_at", "INTEGER");
  ensureColumn(db, "targets", "opportunity_score", "INTEGER");
  ensureColumn(db, "targets", "opportunity_findings", "TEXT");
  ensureColumn(db, "analyzed_sites", "latest_opportunity_score", "INTEGER");
  ensureColumn(db, "site_snapshots", "opportunity_score", "INTEGER");
  ensureColumn(db, "site_snapshots", "opportunity_findings_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "agent_artifacts", "body_storage", "TEXT NOT NULL DEFAULT 'inline'");
  ensureColumn(db, "agent_artifacts", "object_key", "TEXT");
  ensureColumn(db, "agent_artifacts", "content_type", "TEXT");
  ensureColumn(db, "agent_artifacts", "byte_size", "INTEGER");
  ensureColumn(db, "site_proposals", "body_storage", "TEXT NOT NULL DEFAULT 'inline'");
  ensureColumn(db, "site_proposals", "object_key", "TEXT");
  ensureColumn(db, "site_proposals", "content_type", "TEXT");
  ensureColumn(db, "site_proposals", "byte_size", "INTEGER");
}

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  definition: string
): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (rows.some((row) => row.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
