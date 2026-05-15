import Database from "better-sqlite3";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("operational storage migration", () => {
  it("initializes the D1-compatible operational schema", async () => {
    const db = new Database(":memory:");
    const migrationDir = join(process.cwd(), "migrations");
    const migrationFiles = (await readdir(migrationDir)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of migrationFiles) {
      db.exec(await readFile(join(migrationDir, file), "utf8"));
    }

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as {
      name: string;
    }[];
    expect(tables.map((table) => table.name)).toEqual([
      "agent_artifacts",
      "agent_run_steps",
      "agent_runs",
      "analyzed_sites",
      "app_settings",
      "outreach_log",
      "sales_outreach_messages",
      "sales_payment_links",
      "site_proposals",
      "site_snapshots",
      "targets",
    ]);

    const artifactColumns = db.prepare("PRAGMA table_info(agent_artifacts)").all() as { name: string }[];
    expect(artifactColumns.map((column) => column.name)).toContain("object_key");
    expect(artifactColumns.map((column) => column.name)).toContain("body_storage");

    const outreachColumns = db.prepare("PRAGMA table_info(sales_outreach_messages)").all() as { name: string }[];
    expect(outreachColumns.map((column) => column.name)).toContain("recipient_email");
    expect(outreachColumns.map((column) => column.name)).toContain("sent_at");

    const paymentColumns = db.prepare("PRAGMA table_info(sales_payment_links)").all() as { name: string }[];
    expect(paymentColumns.map((column) => column.name)).toContain("payment_link_url");
    expect(paymentColumns.map((column) => column.name)).toContain("amount_jpy");

    db.close();
  });
});
