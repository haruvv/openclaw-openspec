import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("stock market data scanner", () => {
  beforeEach(async () => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "stock-market-scanner-"));
    process.env.DB_PATH = join(dir, "pipeline.db");
    delete process.env.DURABLE_STORAGE_BASE_URL;
    delete process.env.DURABLE_STORAGE_TOKEN;
  });

  it("creates provider candidates from breakout volume candles", async () => {
    const {
      listStockMarketCandidates,
      upsertStockCandles,
      upsertStockMarketDataWatchlistEntry,
    } = await import("../src/stock-trading/repository.js");
    const { scanStockMarketDataCandidates } = await import("../src/stock-trading/market-data-scanner.js");
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "moomoo" });
    await upsertStockCandles([
      { symbol: "NVDA", timeframe: "1d", open: 100, high: 101, low: 99, close: 100, volume: 1000, source: "moomoo", timestamp: new Date("2026-05-01T00:00:00.000Z") },
      { symbol: "NVDA", timeframe: "1d", open: 100, high: 102, low: 99, close: 101, volume: 1100, source: "moomoo", timestamp: new Date("2026-05-02T00:00:00.000Z") },
      { symbol: "NVDA", timeframe: "1d", open: 101, high: 103, low: 100, close: 102, volume: 1000, source: "moomoo", timestamp: new Date("2026-05-03T00:00:00.000Z") },
      { symbol: "NVDA", timeframe: "1d", open: 102, high: 104, low: 101, close: 103, volume: 1200, source: "moomoo", timestamp: new Date("2026-05-04T00:00:00.000Z") },
      { symbol: "NVDA", timeframe: "1d", open: 103, high: 105, low: 102, close: 104, volume: 1000, source: "moomoo", timestamp: new Date("2026-05-05T00:00:00.000Z") },
      { symbol: "NVDA", timeframe: "1d", open: 104, high: 110, low: 103, close: 109, volume: 2500, source: "moomoo", timestamp: new Date("2026-05-06T00:00:00.000Z") },
    ]);

    await expect(scanStockMarketDataCandidates()).resolves.toMatchObject({
      scannedEntries: 1,
      createdCandidates: 1,
      skippedEntries: 0,
      candidates: [{ symbol: "NVDA", source: "provider", strategyTag: "breakout_momentum" }],
    });
    await expect(listStockMarketCandidates({ status: "watch" })).resolves.toMatchObject([
      { symbol: "NVDA", source: "provider", reason: expect.stringContaining("Provider Market Scanner"), rawPayload: expect.objectContaining({ price: 109 }) },
    ]);
  });

  it("skips entries with insufficient candle history", async () => {
    const { upsertStockCandles, upsertStockMarketDataWatchlistEntry } = await import("../src/stock-trading/repository.js");
    const { scanStockMarketDataCandidates } = await import("../src/stock-trading/market-data-scanner.js");
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "moomoo" });
    await upsertStockCandles([
      { symbol: "NVDA", timeframe: "1d", open: 100, high: 101, low: 99, close: 100, volume: 1000, source: "moomoo", timestamp: new Date("2026-05-01T00:00:00.000Z") },
    ]);

    await expect(scanStockMarketDataCandidates()).resolves.toMatchObject({
      scannedEntries: 1,
      createdCandidates: 0,
      skippedEntries: 1,
    });
  });
});
