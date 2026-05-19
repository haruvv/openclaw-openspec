import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("stock trading autonomous paper cycle", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
    const dir = await mkdtemp(join(tmpdir(), "stock-trading-automation-"));
    process.env.DB_PATH = join(dir, "pipeline.db");
    process.env.STOCK_AI_DECISION_MODE = "deterministic";
    process.env.STOCK_PAPER_TRADE_CONFIDENCE_THRESHOLD = "0.5";
    delete process.env.DURABLE_STORAGE_BASE_URL;
    delete process.env.DURABLE_STORAGE_TOKEN;
    delete process.env.STOCK_MARKET_DATA_PROVIDER_URL;
    delete process.env.STOCK_MARKET_DATA_PROVIDER_TOKEN;
  });

  it("collects, scans, and converts an eligible provider candidate", async () => {
    const { upsertStockMarketDataWatchlistEntry, listStockAiDecisions, listStockMarketCandidates, listStockTrades } = await import("../src/stock-trading/repository.js");
    const { runStockAutonomousPaperCycle } = await import("../src/stock-trading/automation.js");
    process.env.STOCK_MARKET_DATA_PROVIDER_URL = "https://provider.example/candles";
    vi.stubGlobal("fetch", vi.fn(async () => createCandleResponse()));
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "moomoo" });

    const result = await runStockAutonomousPaperCycle({ threshold: 0.6, candidateLimit: 3 });

    expect(result).toMatchObject({
      status: "completed",
      collectionRun: { status: "completed", requestedEntries: 1, upsertedCandles: 6 },
      scan: { scannedEntries: 1, createdCandidates: 1, skippedEntries: 0 },
      eligibleCandidates: 1,
      convertedCount: 1,
      errorCount: 0,
      conversions: [{ symbol: "NVDA", finalAction: "BUY", status: "executed" }],
    });
    await expect(listStockMarketCandidates()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "NVDA", source: "provider", status: "converted_to_decision" }),
    ]));
    await expect(listStockAiDecisions(10)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "NVDA", finalAction: "BUY" }),
    ]));
    await expect(listStockTrades(10)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "NVDA", executionSource: "paper" }),
    ]));
  });

  it("returns zero conversions when no provider candidate meets the threshold", async () => {
    const { upsertStockMarketDataWatchlistEntry } = await import("../src/stock-trading/repository.js");
    const { runStockAutonomousPaperCycle } = await import("../src/stock-trading/automation.js");
    process.env.STOCK_MARKET_DATA_PROVIDER_URL = "https://provider.example/candles";
    vi.stubGlobal("fetch", vi.fn(async () => createCandleResponse()));
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "moomoo" });

    await expect(runStockAutonomousPaperCycle({ threshold: 0.99 })).resolves.toMatchObject({
      status: "completed",
      eligibleCandidates: 0,
      convertedCount: 0,
      skippedCount: 1,
      errorCount: 0,
    });
  });

  it("returns a failed summary when provider configuration is missing", async () => {
    const { upsertStockMarketDataWatchlistEntry } = await import("../src/stock-trading/repository.js");
    const { runStockAutonomousPaperCycle } = await import("../src/stock-trading/automation.js");
    await upsertStockMarketDataWatchlistEntry({ id: "watchlist-1", symbol: "NVDA", timeframe: "1d", provider: "moomoo" });

    await expect(runStockAutonomousPaperCycle()).resolves.toMatchObject({
      status: "failed",
      collectionRun: { status: "failed", requestedEntries: 1, completedEntries: 0 },
      convertedCount: 0,
      errorCount: 1,
      errors: [{ error: "stock_market_data_provider_not_configured" }],
    });
  });
});

function createCandleResponse(): Response {
  return new Response(JSON.stringify({
    candles: [
      { timestamp: "2026-05-01T00:00:00.000Z", open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { timestamp: "2026-05-02T00:00:00.000Z", open: 100, high: 102, low: 99, close: 101, volume: 1100 },
      { timestamp: "2026-05-03T00:00:00.000Z", open: 101, high: 103, low: 100, close: 102, volume: 1000 },
      { timestamp: "2026-05-04T00:00:00.000Z", open: 102, high: 104, low: 101, close: 103, volume: 1200 },
      { timestamp: "2026-05-05T00:00:00.000Z", open: 103, high: 105, low: 102, close: 104, volume: 1000 },
      { timestamp: "2026-05-06T00:00:00.000Z", open: 104, high: 110, low: 103, close: 109, volume: 2500 },
    ],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
