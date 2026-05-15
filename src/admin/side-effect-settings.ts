import { DurableHttpStorageClient, getStorageConfig } from "../storage/index.js";
import { getDb } from "../utils/db.js";

export interface SideEffectSettings {
  sendEmail: boolean;
  sendTelegram: boolean;
  createPaymentLink: boolean;
  configuredFromAdmin: boolean;
}

export interface SaveSideEffectSettingsInput {
  sendEmail?: unknown;
  sendTelegram?: unknown;
  createPaymentLink?: unknown;
}

const SIDE_EFFECT_SETTING_KEYS = [
  "sideEffects.sendEmail",
  "sideEffects.sendTelegram",
  "sideEffects.createPaymentLink",
] as const;

type SideEffectSettingKey = (typeof SIDE_EFFECT_SETTING_KEYS)[number];

export async function getSideEffectSettings(env: NodeJS.ProcessEnv = process.env): Promise<SideEffectSettings> {
  const stored = await readStoredSettings();
  const hasStored = SIDE_EFFECT_SETTING_KEYS.some((key) => stored.has(key));
  return {
    sendEmail: readBoolean(stored.get("sideEffects.sendEmail") ?? env.REVENUE_AGENT_ALLOW_EMAIL),
    sendTelegram: readBoolean(stored.get("sideEffects.sendTelegram") ?? env.REVENUE_AGENT_ALLOW_TELEGRAM),
    createPaymentLink: readBoolean(stored.get("sideEffects.createPaymentLink") ?? env.REVENUE_AGENT_ALLOW_PAYMENT_LINK),
    configuredFromAdmin: hasStored,
  };
}

export async function saveSideEffectSettings(input: SaveSideEffectSettingsInput): Promise<SideEffectSettings> {
  const settings: SideEffectSettings = {
    sendEmail: input.sendEmail === true,
    sendTelegram: input.sendTelegram === true,
    createPaymentLink: input.createPaymentLink === true,
    configuredFromAdmin: true,
  };

  await writeStoredSettings(new Map<SideEffectSettingKey, string>([
    ["sideEffects.sendEmail", String(settings.sendEmail)],
    ["sideEffects.sendTelegram", String(settings.sendTelegram)],
    ["sideEffects.createPaymentLink", String(settings.createPaymentLink)],
  ]));

  return settings;
}

export function applySideEffectSettingsToEnv(env: NodeJS.ProcessEnv, settings: SideEffectSettings): NodeJS.ProcessEnv {
  return {
    ...env,
    REVENUE_AGENT_ALLOW_EMAIL: String(settings.sendEmail),
    REVENUE_AGENT_ALLOW_TELEGRAM: String(settings.sendTelegram),
    REVENUE_AGENT_ALLOW_PAYMENT_LINK: String(settings.createPaymentLink),
  };
}

function readBoolean(value: string | undefined): boolean {
  return value === "true";
}

async function readStoredSettings(): Promise<Map<SideEffectSettingKey, string>> {
  const durable = getDurableClient();
  const keys = [...SIDE_EFFECT_SETTING_KEYS];
  if (durable) {
    const results = await durable.executeSql<{ key: SideEffectSettingKey; value: string }>([
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
    .all(...keys) as Array<{ key: SideEffectSettingKey; value: string }>;
  return new Map(rows.map((row) => [row.key, row.value]));
}

async function writeStoredSettings(values: Map<SideEffectSettingKey, string>): Promise<void> {
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
