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
  `);
}
