import Database from "better-sqlite3";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH ?? "./data/pipeline.db";

let _db: Database.Database | null = null;

export async function getDb(): Promise<Database.Database> {
  if (_db) return _db;
  await mkdir(dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  initSchema(_db);
  return _db;
}

export function resetDb(): void {
  _db = null;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      url TEXT NOT NULL,
      contact_email TEXT,
      industry TEXT,
      seo_score INTEGER NOT NULL,
      diagnostics TEXT NOT NULL,
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
  `);
  ensureColumn(db, "targets", "payment_link_expires_at", "INTEGER");
  ensureColumn(db, "targets", "payment_reminder_sent_at", "INTEGER");
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
