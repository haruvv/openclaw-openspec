import {
  createStockMarketDataCollectionRun,
  listStockMarketDataWatchlistEntries,
  updateStockMarketDataWatchlistEntry,
  upsertStockCandles,
} from "./repository.js";
import type {
  CreateStockCandleInput,
  StockMarketDataCollectionRun,
  StockMarketDataWatchlistEntry,
} from "./types.js";

export interface StockCandleProvider {
  fetchCandles(entry: StockMarketDataWatchlistEntry): Promise<CreateStockCandleInput[]>;
}

export interface RunStockMarketDataCollectorOptions {
  provider?: StockCandleProvider;
  env?: NodeJS.ProcessEnv;
}

export async function runStockMarketDataCollector(options: RunStockMarketDataCollectorOptions = {}): Promise<StockMarketDataCollectionRun> {
  const startedAt = new Date();
  const provider = options.provider ?? createHttpStockCandleProvider(options.env ?? process.env);
  const entries = await listStockMarketDataWatchlistEntries({ enabled: true, limit: 200 });
  const providerName = entries[0]?.provider ?? "market-data-provider";
  let completedEntries = 0;
  let upsertedCandles = 0;
  try {
    for (const entry of entries) {
      const candles = await provider.fetchCandles(entry);
      if (candles.length > 0) {
        const stored = await upsertStockCandles(candles);
        upsertedCandles += stored.length;
      }
      completedEntries += 1;
      await updateStockMarketDataWatchlistEntry(entry.id, { lastCollectedAt: new Date() });
    }
    return createStockMarketDataCollectionRun({
      provider: providerName,
      status: "completed",
      requestedEntries: entries.length,
      completedEntries,
      upsertedCandles,
      startedAt,
      completedAt: new Date(),
    });
  } catch (error) {
    return createStockMarketDataCollectionRun({
      provider: providerName,
      status: "failed",
      requestedEntries: entries.length,
      completedEntries,
      upsertedCandles,
      error: error instanceof Error ? error.message : String(error),
      startedAt,
      completedAt: new Date(),
    });
  }
}

export function createHttpStockCandleProvider(env: NodeJS.ProcessEnv = process.env): StockCandleProvider {
  if ((env.STOCK_MARKET_DATA_PROVIDER_KIND ?? "").toLowerCase() === "twelvedata") {
    return createTwelveDataStockCandleProvider(env);
  }
  const endpoint = env.STOCK_MARKET_DATA_PROVIDER_URL;
  const token = env.STOCK_MARKET_DATA_PROVIDER_TOKEN;
  return {
    async fetchCandles(entry) {
      if (!endpoint) throw new Error("stock_market_data_provider_not_configured");
      const url = new URL(endpoint);
      url.searchParams.set("symbol", entry.symbol);
      url.searchParams.set("timeframe", entry.timeframe);
      url.searchParams.set("limit", String(entry.lookbackLimit));
      url.searchParams.set("provider", entry.provider);
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(`stock_market_data_provider_http_${response.status}`);
      const payload = await response.json() as unknown;
      return parseProviderCandles(payload, entry);
    },
  };
}

export function createTwelveDataStockCandleProvider(env: NodeJS.ProcessEnv = process.env): StockCandleProvider {
  const apiKey = env.TWELVE_DATA_API_KEY;
  const endpoint = env.TWELVE_DATA_API_BASE_URL ?? "https://api.twelvedata.com/time_series";
  return {
    async fetchCandles(entry) {
      if (!apiKey) throw new Error("twelve_data_api_key_not_configured");
      const url = new URL(endpoint);
      url.searchParams.set("symbol", entry.symbol);
      url.searchParams.set("interval", mapTwelveDataInterval(entry.timeframe));
      url.searchParams.set("outputsize", String(entry.lookbackLimit));
      url.searchParams.set("apikey", apiKey);
      url.searchParams.set("format", "JSON");
      url.searchParams.set("order", "asc");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`twelve_data_http_${response.status}`);
      const payload = await response.json() as unknown;
      return parseTwelveDataCandles(payload, entry);
    },
  };
}

export function parseProviderCandles(payload: unknown, entry: StockMarketDataWatchlistEntry): CreateStockCandleInput[] {
  const sourceCandles = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { candles?: unknown }).candles)
      ? (payload as { candles: unknown[] }).candles
      : null;
  if (!sourceCandles) throw new Error("stock_market_data_invalid_candles_response");
  return sourceCandles.map((value, index) => parseProviderCandle(value, index, entry));
}

export function parseTwelveDataCandles(payload: unknown, entry: StockMarketDataWatchlistEntry): CreateStockCandleInput[] {
  if (!payload || typeof payload !== "object") throw new Error("twelve_data_invalid_response");
  const record = payload as Record<string, unknown>;
  if (typeof record.status === "string" && record.status.toLowerCase() === "error") {
    const message = typeof record.message === "string" && record.message.trim()
      ? record.message.trim()
      : "unknown";
    throw new Error(`twelve_data_api_error:${message}`);
  }
  if (!Array.isArray(record.values)) throw new Error("twelve_data_invalid_values_response");
  return record.values.map((value, index) => parseTwelveDataCandle(value, index, entry));
}

function parseProviderCandle(value: unknown, index: number, entry: StockMarketDataWatchlistEntry): CreateStockCandleInput {
  if (!value || typeof value !== "object") throw new Error(`stock_market_data_invalid_candle:${index}`);
  const record = value as Record<string, unknown>;
  const timestamp = parseTimestamp(record.timestamp ?? record.time ?? record.t);
  const open = readFiniteNumber(record.open ?? record.o);
  const high = readFiniteNumber(record.high ?? record.h);
  const low = readFiniteNumber(record.low ?? record.l);
  const close = readFiniteNumber(record.close ?? record.c);
  const volume = readFiniteNumber(record.volume ?? record.v);
  if (!timestamp || open === null || high === null || low === null || close === null || volume === null) {
    throw new Error(`stock_market_data_invalid_candle:${index}`);
  }
  return {
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    open,
    high,
    low,
    close,
    volume,
    source: entry.provider,
    timestamp,
  };
}

function parseTwelveDataCandle(value: unknown, index: number, entry: StockMarketDataWatchlistEntry): CreateStockCandleInput {
  if (!value || typeof value !== "object") throw new Error(`twelve_data_invalid_candle:${index}`);
  const record = value as Record<string, unknown>;
  const timestamp = parseTimestamp(record.datetime);
  const open = readFiniteNumber(record.open);
  const high = readFiniteNumber(record.high);
  const low = readFiniteNumber(record.low);
  const close = readFiniteNumber(record.close);
  const volume = readFiniteNumber(record.volume ?? 0) ?? 0;
  if (!timestamp || open === null || high === null || low === null || close === null) {
    throw new Error(`twelve_data_invalid_candle:${index}`);
  }
  return {
    symbol: entry.symbol,
    timeframe: entry.timeframe,
    open,
    high,
    low,
    close,
    volume,
    source: entry.provider,
    timestamp,
  };
}

function mapTwelveDataInterval(timeframe: string): string {
  const normalized = timeframe.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "1m": "1min",
    "5m": "5min",
    "15m": "15min",
    "30m": "30min",
    "45m": "45min",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "1d": "1day",
    "d": "1day",
    "1w": "1week",
    "w": "1week",
    "1mo": "1month",
    "1month": "1month",
  };
  return aliases[normalized] ?? normalized;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}
