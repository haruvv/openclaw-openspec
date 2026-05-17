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
      "stock_agent_decisions",
      "stock_ai_decisions",
      "stock_backtest_runs",
      "stock_backtest_trades",
      "stock_candles",
      "stock_decision_learning_refs",
      "stock_learning_items",
      "stock_market_signals",
      "stock_portfolio_snapshots",
      "stock_positions",
      "stock_research_items",
      "stock_trades",
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

    const tradeColumns = db.prepare("PRAGMA table_info(stock_trades)").all() as { name: string }[];
    expect(tradeColumns.map((column) => column.name)).toContain("execution_source");
    expect(tradeColumns.map((column) => column.name)).toContain("raw_execution_json");

    const signalColumns = db.prepare("PRAGMA table_info(stock_market_signals)").all() as { name: string }[];
    expect(signalColumns.map((column) => column.name)).toContain("source_signal_id");
    expect(signalColumns.map((column) => column.name)).toContain("indicators_json");
    expect(signalColumns.map((column) => column.name)).toContain("raw_payload_json");

    const positionColumns = db.prepare("PRAGMA table_info(stock_positions)").all() as { name: string }[];
    expect(positionColumns.map((column) => column.name)).toContain("average_entry_price");
    expect(positionColumns.map((column) => column.name)).toContain("last_mark_price");

    const researchColumns = db.prepare("PRAGMA table_info(stock_research_items)").all() as { name: string }[];
    expect(researchColumns.map((column) => column.name)).toContain("category");
    expect(researchColumns.map((column) => column.name)).toContain("sentiment");

    const candleColumns = db.prepare("PRAGMA table_info(stock_candles)").all() as { name: string }[];
    expect(candleColumns.map((column) => column.name)).toContain("timestamp");
    expect(candleColumns.map((column) => column.name)).toContain("timeframe");

    const backtestColumns = db.prepare("PRAGMA table_info(stock_backtest_runs)").all() as { name: string }[];
    expect(backtestColumns.map((column) => column.name)).toContain("profit_factor");
    expect(backtestColumns.map((column) => column.name)).toContain("maximum_drawdown");

    const decisionLearningColumns = db.prepare("PRAGMA table_info(stock_decision_learning_refs)").all() as { name: string }[];
    expect(decisionLearningColumns.map((column) => column.name)).toContain("decision_id");
    expect(decisionLearningColumns.map((column) => column.name)).toContain("learning_item_id");

    db.close();
  });
});
