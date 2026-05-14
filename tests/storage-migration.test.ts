import Database from "better-sqlite3";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("operational storage migration", () => {
  it("initializes the D1-compatible operational schema", async () => {
    const db = new Database(":memory:");
    const sql = await readFile(join(process.cwd(), "migrations/0001_operational_data.sql"), "utf8");

    db.exec(sql);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[];
    expect(tables.map((table) => table.name)).toEqual([
      "agent_artifacts",
      "agent_run_steps",
      "agent_runs",
      "analyzed_sites",
      "outreach_log",
      "site_proposals",
      "site_snapshots",
      "targets",
    ]);

    const artifactColumns = db.prepare("PRAGMA table_info(agent_artifacts)").all() as { name: string }[];
    expect(artifactColumns.map((column) => column.name)).toContain("object_key");
    expect(artifactColumns.map((column) => column.name)).toContain("body_storage");

    db.close();
  });
});
