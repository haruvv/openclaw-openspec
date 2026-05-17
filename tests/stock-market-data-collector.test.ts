import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("stock market data collector", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    const dir = await mkdtemp(join(tmpdir(), "stock-market-data-"));
    process.env.DB_PATH = join(dir, "pipeline.db");
    delete process.env.DURABLE_STORAGE_BASE_URL;
    delete process.env.DURABLE_STORAGE_TOKEN;
    delete process.env.STOCK_MARKET_DATA_PROVIDER_URL;
    delete process.env.STOCK_MARKET_DATA_PROVIDER_TOKEN;
  });

  it("collects provider candles for enabled watchlist entries without duplicating candle rows", async () => {
    const {
      listStockCandles,
      listStockMarketDataCollectionRuns,
      upsertStockMarketDataWatchlistEntry,
    } = await import("../src/stock-trading/repository.js");
    const { runStockMarketDataCollector } = await import("../src/stock-trading/market-data-collector.js");

    await upsertStockMarketDataWatchlistEntry({
      id: "watchlist-1",
      symbol: "nvda",
      timeframe: "1d",
      provider: "moomoo",
      lookbackLimit: 2,
    });

    const provider = {
      fetchCandles: vi.fn(async (entry) => [
        { symbol: entry.symbol, timeframe: entry.timeframe, open: 100, high: 102, low: 99, close: 101, volume: 1000, source: entry.provider, timestamp: new Date("2026-05-01T00:00:00.000Z") },
        { symbol: entry.symbol, timeframe: entry.timeframe, open: 101, high: 103, low: 100, close: 102, volume: 1200, source: entry.provider, timestamp: new Date("2026-05-02T00:00:00.000Z") },
      ]),
    };

    await expect(runStockMarketDataCollector({ provider })).resolves.toMatchObject({
      provider: "moomoo",
      status: "completed",
      requestedEntries: 1,
      completedEntries: 1,
      upsertedCandles: 2,
    });
    await runStockMarketDataCollector({ provider });

    await expect(listStockCandles({ symbol: "NVDA", timeframe: "1d" })).resolves.toHaveLength(2);
    await expect(listStockMarketDataCollectionRuns()).resolves.toHaveLength(2);
  });

  it("records failed runs when the provider endpoint is missing", async () => {
    const { upsertStockMarketDataWatchlistEntry } = await import("../src/stock-trading/repository.js");
    const { runStockMarketDataCollector } = await import("../src/stock-trading/market-data-collector.js");
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "moomoo" });

    await expect(runStockMarketDataCollector()).resolves.toMatchObject({
      status: "failed",
      requestedEntries: 1,
      completedEntries: 0,
      error: "stock_market_data_provider_not_configured",
    });
  });

  it("rejects invalid provider candle responses", async () => {
    process.env.STOCK_MARKET_DATA_PROVIDER_URL = "https://provider.example/candles";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ candles: [{ timestamp: "bad", open: 1 }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    const { upsertStockMarketDataWatchlistEntry } = await import("../src/stock-trading/repository.js");
    const { runStockMarketDataCollector } = await import("../src/stock-trading/market-data-collector.js");
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "moomoo" });

    await expect(runStockMarketDataCollector()).resolves.toMatchObject({
      status: "failed",
      error: "stock_market_data_invalid_candle:0",
    });
  });
});
