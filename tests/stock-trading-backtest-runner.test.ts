import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("stock trading backtest runner", () => {
  beforeEach(async () => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "stock-backtest-"));
    process.env.DB_PATH = join(dir, "pipeline.db");
    delete process.env.DURABLE_STORAGE_BASE_URL;
    delete process.env.DURABLE_STORAGE_TOKEN;
  });

  it("runs a profitable breakout momentum backtest without mutating paper state", async () => {
    const { upsertStockCandles, listStockBacktestRuns, listStockPortfolioSnapshots, listStockPositions, listStockTrades } = await import("../src/stock-trading/repository.js");
    const { runStockBacktest } = await import("../src/stock-trading/backtest-runner.js");
    await upsertStockCandles(createBacktestCandles([
      [100, 101, 99, 100, 1000],
      [100, 102, 99, 101, 1000],
      [101, 103, 100, 102, 1000],
      [102, 106, 101, 105, 2200],
      [105, 113, 104, 112, 1800],
      [112, 114, 110, 113, 1600],
    ]));

    const run = await runStockBacktest({
      symbol: "NVDA",
      timeframe: "1d",
      strategyTag: "breakout_momentum",
      lookbackBars: 3,
      volumeLookbackBars: 3,
      takeProfitPct: 0.06,
      stopLossPct: 0.03,
      maxHoldingBars: 3,
      notional: 100000,
      feeBps: 0,
      slippageBps: 5,
    });

    expect(run).toMatchObject({
      symbol: "NVDA",
      strategyTag: "breakout_momentum",
      status: "completed",
      candleCount: 6,
      tradeCount: 1,
      winRate: 1,
      grossLoss: 0,
    });
    expect(run.realizedPnl).toBeGreaterThan(0);
    expect(run.trades).toHaveLength(1);
    expect(run.trades[0]).toMatchObject({ outcome: "win", holdingBars: 1 });
    await expect(listStockBacktestRuns()).resolves.toHaveLength(1);
    await expect(listStockTrades()).resolves.toEqual([]);
    await expect(listStockPositions({ openOnly: false })).resolves.toEqual([]);
    await expect(listStockPortfolioSnapshots()).resolves.toEqual([]);
  });

  it("persists a completed no-trade run with null ratio metrics", async () => {
    const { upsertStockCandles } = await import("../src/stock-trading/repository.js");
    const { runStockBacktest } = await import("../src/stock-trading/backtest-runner.js");
    await upsertStockCandles(createBacktestCandles([
      [100, 105, 99, 100, 1000],
      [100, 105, 99, 100, 1000],
      [100, 105, 99, 100, 1000],
      [100, 104, 99, 100, 800],
      [100, 104, 99, 100, 800],
    ]));

    const run = await runStockBacktest({ symbol: "NVDA", timeframe: "1d", strategyTag: "breakout_momentum" });

    expect(run).toMatchObject({
      tradeCount: 0,
      winRate: null,
      expectancy: null,
      profitFactor: null,
      realizedPnl: 0,
      trades: [],
    });
  });

  it("rejects insufficient candle history", async () => {
    const { upsertStockCandles } = await import("../src/stock-trading/repository.js");
    const { runStockBacktest } = await import("../src/stock-trading/backtest-runner.js");
    await upsertStockCandles(createBacktestCandles([
      [100, 101, 99, 100, 1000],
      [100, 102, 99, 101, 1000],
    ]));

    await expect(runStockBacktest({ symbol: "NVDA", timeframe: "1d", strategyTag: "breakout_momentum" })).rejects.toThrow("insufficient_candles");
  });
});

function createBacktestCandles(values: Array<[number, number, number, number, number]>) {
  return values.map(([open, high, low, close, volume], index) => ({
    symbol: "NVDA",
    timeframe: "1d",
    open,
    high,
    low,
    close,
    volume,
    timestamp: new Date(Date.UTC(2026, 4, index + 1)),
  }));
}
