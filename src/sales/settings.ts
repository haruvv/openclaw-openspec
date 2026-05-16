import { DurableHttpStorageClient, getStorageConfig } from "../storage/index.js";
import { getDb } from "../utils/db.js";

export interface SalesOperationSettings {
  defaultPaymentAmountJpy: number;
  outreachCooldownDays: number;
  contactDiscoveryMaxPages: number;
  sendgridFromName: string;
  configuredFromAdmin: boolean;
}

export interface SaveSalesOperationSettingsInput {
  defaultPaymentAmountJpy?: unknown;
  outreachCooldownDays?: unknown;
  contactDiscoveryMaxPages?: unknown;
  sendgridFromName?: unknown;
}

const SALES_SETTING_KEYS = [
  "sales.defaultPaymentAmountJpy",
  "sales.outreachCooldownDays",
  "sales.contactDiscoveryMaxPages",
  "sales.sendgridFromName",
] as const;

type SalesSettingKey = (typeof SALES_SETTING_KEYS)[number];

export async function getSalesOperationSettings(env: NodeJS.ProcessEnv = process.env): Promise<SalesOperationSettings> {
  const stored = await readStoredSettings();
  const hasStored = SALES_SETTING_KEYS.some((key) => stored.has(key));
  return {
    defaultPaymentAmountJpy: readBoundedInteger(
      stored.get("sales.defaultPaymentAmountJpy") ?? env.REVENUE_AGENT_DEFAULT_PAYMENT_AMOUNT_JPY,
      50_000,
      1,
      10_000_000,
    ),
    outreachCooldownDays: readBoundedInteger(
      stored.get("sales.outreachCooldownDays") ?? env.OUTREACH_COOLDOWN_DAYS,
      30,
      0,
      365,
    ),
    contactDiscoveryMaxPages: readBoundedInteger(
      stored.get("sales.contactDiscoveryMaxPages") ?? env.CONTACT_DISCOVERY_MAX_PAGES,
      5,
      0,
      20,
    ),
    sendgridFromName: readPlainText(stored.get("sales.sendgridFromName") ?? env.SENDGRID_FROM_NAME, "RevenueAgentPlatform"),
    configuredFromAdmin: hasStored,
  };
}

export async function saveSalesOperationSettings(input: SaveSalesOperationSettingsInput): Promise<SalesOperationSettings> {
  const settings: SalesOperationSettings = {
    defaultPaymentAmountJpy: readBoundedInteger(String(input.defaultPaymentAmountJpy ?? ""), 50_000, 1, 10_000_000),
    outreachCooldownDays: readBoundedInteger(String(input.outreachCooldownDays ?? ""), 30, 0, 365),
    contactDiscoveryMaxPages: readBoundedInteger(String(input.contactDiscoveryMaxPages ?? ""), 5, 0, 20),
    sendgridFromName: readPlainText(String(input.sendgridFromName ?? ""), "RevenueAgentPlatform"),
    configuredFromAdmin: true,
  };

  await writeStoredSettings(new Map<SalesSettingKey, string>([
    ["sales.defaultPaymentAmountJpy", String(settings.defaultPaymentAmountJpy)],
    ["sales.outreachCooldownDays", String(settings.outreachCooldownDays)],
    ["sales.contactDiscoveryMaxPages", String(settings.contactDiscoveryMaxPages)],
    ["sales.sendgridFromName", settings.sendgridFromName],
  ]));

  return settings;
}

function readBoundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function readPlainText(value: string | undefined, fallback: string): string {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  return normalized || fallback;
}

async function readStoredSettings(): Promise<Map<SalesSettingKey, string>> {
  const durable = getDurableClient();
  const keys = [...SALES_SETTING_KEYS];
  if (durable) {
    const results = await durable.executeSql<{ key: SalesSettingKey; value: string }>([
      {
        sql: `SELECT key, value FROM app_settings WHERE key IN (${keys.map(() => "?").join(", ")})`,
        params: keys,
      },
    ]);
    return new Map((results[0]?.results ?? []).map((row) => [row.key, row.value]));
  }

  const db = await getDb();
  const rows = db
    .prepare(`SELECT key, value FROM app_settings WHERE key IN (${keys.map(() => "?").join(", ")})`)
    .all(...keys) as Array<{ key: SalesSettingKey; value: string }>;
  return new Map(rows.map((row) => [row.key, row.value]));
}

async function writeStoredSettings(values: Map<SalesSettingKey, string>): Promise<void> {
  const durable = getDurableClient();
  const now = Date.now();
  const statements = [...values].map(([key, value]) => ({
    sql: "INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)",
    params: [key, value, now],
  }));

  if (durable) {
    await durable.executeSql(statements);
    return;
  }

  const db = await getDb();
  const tx = db.transaction(() => {
    const statement = db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)");
    for (const [key, value] of values) statement.run(key, value, now);
  });
  tx();
}

function getDurableClient(): DurableHttpStorageClient | null {
  const config = getStorageConfig();
  if (config.mode !== "durable-http" || !config.durableHttp) return null;
  return new DurableHttpStorageClient({ config: config.durableHttp });
}
