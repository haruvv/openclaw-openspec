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
    delete process.env.STOCK_MARKET_DATA_PROVIDER_KIND;
    delete process.env.TWELVE_DATA_API_KEY;
    delete process.env.TWELVE_DATA_API_BASE_URL;
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

  it("collects candles directly from Twelve Data when selected", async () => {
    process.env.STOCK_MARKET_DATA_PROVIDER_KIND = "twelvedata";
    process.env.TWELVE_DATA_API_KEY = "td-test";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe("https://api.twelvedata.com/time_series");
      expect(url.searchParams.get("symbol")).toBe("NVDA");
      expect(url.searchParams.get("interval")).toBe("1day");
      expect(url.searchParams.get("outputsize")).toBe("2");
      expect(url.searchParams.get("apikey")).toBe("td-test");
      expect(url.searchParams.get("order")).toBe("asc");
      return new Response(JSON.stringify({
        values: [
          { datetime: "2026-05-01", open: "100", high: "102", low: "99", close: "101", volume: "1000" },
          { datetime: "2026-05-02", open: "101", high: "103", low: "100", close: "102", volume: "1200" },
        ],
        status: "ok",
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
    const { listStockCandles, upsertStockMarketDataWatchlistEntry } = await import("../src/stock-trading/repository.js");
    const { runStockMarketDataCollector } = await import("../src/stock-trading/market-data-collector.js");
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "twelvedata", lookbackLimit: 2 });

    await expect(runStockMarketDataCollector()).resolves.toMatchObject({
      provider: "twelvedata",
      status: "completed",
      requestedEntries: 1,
      completedEntries: 1,
      upsertedCandles: 2,
    });
    await expect(listStockCandles({ symbol: "NVDA", timeframe: "1d" })).resolves.toMatchObject([
      { symbol: "NVDA", timeframe: "1d", close: 101, source: "twelvedata" },
      { symbol: "NVDA", timeframe: "1d", close: 102, source: "twelvedata" },
    ]);
  });

  it("records failed Twelve Data runs when the API key is missing", async () => {
    process.env.STOCK_MARKET_DATA_PROVIDER_KIND = "twelvedata";
    const { upsertStockMarketDataWatchlistEntry } = await import("../src/stock-trading/repository.js");
    const { runStockMarketDataCollector } = await import("../src/stock-trading/market-data-collector.js");
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "twelvedata" });

    await expect(runStockMarketDataCollector()).resolves.toMatchObject({
      status: "failed",
      error: "twelve_data_api_key_not_configured",
    });
  });

  it("records Twelve Data API error responses", async () => {
    process.env.STOCK_MARKET_DATA_PROVIDER_KIND = "twelvedata";
    process.env.TWELVE_DATA_API_KEY = "td-test";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: "error",
      message: "invalid api key",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    const { upsertStockMarketDataWatchlistEntry } = await import("../src/stock-trading/repository.js");
    const { runStockMarketDataCollector } = await import("../src/stock-trading/market-data-collector.js");
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "twelvedata" });

    await expect(runStockMarketDataCollector()).resolves.toMatchObject({
      status: "failed",
      error: "twelve_data_api_error:invalid api key",
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
