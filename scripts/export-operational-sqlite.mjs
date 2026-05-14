#!/usr/bin/env node
import Database from "better-sqlite3";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const TABLES = [
  "targets",
  "outreach_log",
  "agent_runs",
  "agent_run_steps",
  "agent_artifacts",
  "analyzed_sites",
  "site_snapshots",
  "site_proposals",
];

const dbPath = resolve(process.argv[2] ?? process.env.DB_PATH ?? "./data/pipeline.db");
const outputPath = resolve(process.argv[3] ?? "./data/operational-export.sql");

const db = new Database(dbPath, { readonly: true });
const lines = [
  "-- RevenueAgentPlatform operational data export",
  `-- Source: ${dbPath}`,
  `-- Created: ${new Date().toISOString()}`,
  "BEGIN TRANSACTION;",
];

for (const table of TABLES) {
  if (!tableExists(db, table)) continue;
  const columns = getColumns(db, table);
  const rows = db.prepare(`SELECT ${columns.map(quoteIdent).join(", ")} FROM ${quoteIdent(table)}`).all();
  for (const row of rows) {
    const values = columns.map((column) => sqlValue(row[column]));
    lines.push(
      `INSERT OR REPLACE INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(", ")}) VALUES (${values.join(", ")});`,
    );
  }
}

lines.push("COMMIT;");
lines.push("");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, lines.join("\n"));
console.log(`Exported operational data from ${dbPath} to ${outputPath}`);
db.close();

function tableExists(db, table) {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return row !== undefined;
}

function getColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all().map((row) => row.name);
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}
