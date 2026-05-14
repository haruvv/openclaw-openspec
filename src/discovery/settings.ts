import { DurableHttpStorageClient, getStorageConfig } from "../storage/index.js";
import { getDb } from "../utils/db.js";

export interface DiscoverySettings {
  queries: string[];
  seedUrls: string[];
  dailyQuota: number;
  searchLimit: number;
  country: string;
  lang: string;
  location: string;
  configuredFromAdmin: boolean;
}

export interface SaveDiscoverySettingsInput {
  queries?: unknown;
  seedUrls?: unknown;
  dailyQuota?: unknown;
  searchLimit?: unknown;
  country?: unknown;
  lang?: unknown;
  location?: unknown;
}

const DISCOVERY_SETTING_KEYS = [
  "discovery.queries",
  "discovery.seedUrls",
  "discovery.dailyQuota",
  "discovery.searchLimit",
  "discovery.country",
  "discovery.lang",
  "discovery.location",
] as const;

type DiscoverySettingKey = (typeof DISCOVERY_SETTING_KEYS)[number];

export async function getDiscoverySettings(env: NodeJS.ProcessEnv = process.env): Promise<DiscoverySettings> {
  const stored = await readStoredSettings();
  const hasStored = DISCOVERY_SETTING_KEYS.some((key) => stored.has(key));
  return {
    queries: readList(stored.get("discovery.queries") ?? env.REVENUE_AGENT_DISCOVERY_QUERIES),
    seedUrls: readList(stored.get("discovery.seedUrls") ?? env.REVENUE_AGENT_DISCOVERY_SEED_URLS),
    dailyQuota: readBoundedInteger(stored.get("discovery.dailyQuota") ?? env.REVENUE_AGENT_DISCOVERY_DAILY_QUOTA, 3, 1, 10),
    searchLimit: readBoundedInteger(stored.get("discovery.searchLimit") ?? env.REVENUE_AGENT_DISCOVERY_SEARCH_LIMIT, 10, 1, 20),
    country: readShortCode(stored.get("discovery.country") ?? env.REVENUE_AGENT_DISCOVERY_SEARCH_COUNTRY, "jp"),
    lang: readShortCode(stored.get("discovery.lang") ?? env.REVENUE_AGENT_DISCOVERY_SEARCH_LANG, "ja"),
    location: readPlainText(stored.get("discovery.location") ?? env.REVENUE_AGENT_DISCOVERY_SEARCH_LOCATION),
    configuredFromAdmin: hasStored,
  };
}

export async function saveDiscoverySettings(input: SaveDiscoverySettingsInput): Promise<DiscoverySettings> {
  const settings: DiscoverySettings = {
    queries: normalizeList(input.queries),
    seedUrls: normalizeList(input.seedUrls),
    dailyQuota: readBoundedInteger(String(input.dailyQuota ?? ""), 3, 1, 10),
    searchLimit: readBoundedInteger(String(input.searchLimit ?? ""), 10, 1, 20),
    country: readShortCode(String(input.country ?? ""), "jp"),
    lang: readShortCode(String(input.lang ?? ""), "ja"),
    location: readPlainText(String(input.location ?? "")),
    configuredFromAdmin: true,
  };

  await writeStoredSettings(new Map<DiscoverySettingKey, string>([
    ["discovery.queries", settings.queries.join("\n")],
    ["discovery.seedUrls", settings.seedUrls.join("\n")],
    ["discovery.dailyQuota", String(settings.dailyQuota)],
    ["discovery.searchLimit", String(settings.searchLimit)],
    ["discovery.country", settings.country],
    ["discovery.lang", settings.lang],
    ["discovery.location", settings.location],
  ]));

  return settings;
}

export function applyDiscoverySettingsToEnv(env: NodeJS.ProcessEnv, settings: DiscoverySettings): NodeJS.ProcessEnv {
  return {
    ...env,
    REVENUE_AGENT_DISCOVERY_QUERIES: settings.queries.join("\n"),
    REVENUE_AGENT_DISCOVERY_SEED_URLS: settings.seedUrls.join("\n"),
    REVENUE_AGENT_DISCOVERY_DAILY_QUOTA: String(settings.dailyQuota),
    REVENUE_AGENT_DISCOVERY_SEARCH_LIMIT: String(settings.searchLimit),
    REVENUE_AGENT_DISCOVERY_SEARCH_COUNTRY: settings.country,
    REVENUE_AGENT_DISCOVERY_SEARCH_LANG: settings.lang,
    REVENUE_AGENT_DISCOVERY_SEARCH_LOCATION: settings.location,
  };
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeListItem(item));
  }
  return normalizeListItem(value);
}

function normalizeListItem(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const seen = new Set<string>();
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [item];
    });
}

function readList(value: string | undefined): string[] {
  return normalizeList(value);
}

function readBoundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function readShortCode(value: string | undefined, fallback: string): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!/^[a-z]{2,8}$/.test(normalized)) return fallback;
  return normalized;
}

function readPlainText(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 120);
}

async function readStoredSettings(): Promise<Map<DiscoverySettingKey, string>> {
  const durable = getDurableClient();
  const keys = [...DISCOVERY_SETTING_KEYS];
  if (durable) {
    const results = await durable.executeSql<{ key: DiscoverySettingKey; value: string }>([
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
    .all(...keys) as Array<{ key: DiscoverySettingKey; value: string }>;
  return new Map(rows.map((row) => [row.key, row.value]));
}

async function writeStoredSettings(values: Map<DiscoverySettingKey, string>): Promise<void> {
  const durable = getDurableClient();
  const now = Date.now();
  const statements = [...values].map(([key, value]) => ({
    sql: `INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)`,
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
