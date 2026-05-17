import { createStockBacktestRun, listStockCandles } from "./repository.js";
import type { CreateStockBacktestRunInput, RunStockBacktestInput, StockBacktestRunDetail, StockCandle } from "./types.js";

type BacktestParams = Required<Omit<RunStockBacktestInput, "symbol" | "timeframe" | "strategyTag">>;
type SimulatedTrade = NonNullable<CreateStockBacktestRunInput["trades"]>[number];

const DEFAULT_PARAMS: BacktestParams = {
  lookbackBars: 3,
  volumeLookbackBars: 3,
  takeProfitPct: 0.06,
  stopLossPct: 0.03,
  maxHoldingBars: 5,
  notional: 100_000,
  feeBps: 0,
  slippageBps: 5,
};

export async function runStockBacktest(input: RunStockBacktestInput): Promise<StockBacktestRunDetail> {
  const params = normalizeBacktestParams(input);
  if (input.strategyTag !== "breakout_momentum") {
    throw new Error(`unsupported_backtest_strategy:${input.strategyTag}`);
  }
  const candles = await listStockCandles({ symbol: input.symbol, timeframe: input.timeframe, limit: 5000 });
  const minimumCandles = Math.max(params.lookbackBars, params.volumeLookbackBars) + 2;
  if (candles.length < minimumCandles) {
    throw new Error(`insufficient_candles:${candles.length}/${minimumCandles}`);
  }

  const startedAt = new Date();
  const trades = simulateBreakoutMomentum(candles, params);
  const metrics = calculateBacktestMetrics(trades);
  const completedAt = new Date();
  return createStockBacktestRun({
    symbol: input.symbol,
    timeframe: input.timeframe,
    strategyTag: input.strategyTag,
    params,
    status: "completed",
    candleCount: candles.length,
    tradeCount: trades.length,
    ...metrics,
    from: new Date(candles[0].timestamp),
    to: new Date(candles[candles.length - 1].timestamp),
    startedAt,
    completedAt,
    trades,
  });
}

function normalizeBacktestParams(input: RunStockBacktestInput): BacktestParams {
  return {
    lookbackBars: boundedInteger(input.lookbackBars, 2, 200, DEFAULT_PARAMS.lookbackBars),
    volumeLookbackBars: boundedInteger(input.volumeLookbackBars, 2, 200, DEFAULT_PARAMS.volumeLookbackBars),
    takeProfitPct: boundedNumber(input.takeProfitPct, 0.001, 1, DEFAULT_PARAMS.takeProfitPct),
    stopLossPct: boundedNumber(input.stopLossPct, 0.001, 1, DEFAULT_PARAMS.stopLossPct),
    maxHoldingBars: boundedInteger(input.maxHoldingBars, 1, 500, DEFAULT_PARAMS.maxHoldingBars),
    notional: boundedNumber(input.notional, 1, 1_000_000_000, DEFAULT_PARAMS.notional),
    feeBps: boundedNumber(input.feeBps, 0, 1000, DEFAULT_PARAMS.feeBps),
    slippageBps: boundedNumber(input.slippageBps, 0, 1000, DEFAULT_PARAMS.slippageBps),
  };
}

function simulateBreakoutMomentum(candles: StockCandle[], params: BacktestParams): SimulatedTrade[] {
  const trades: SimulatedTrade[] = [];
  const start = Math.max(params.lookbackBars, params.volumeLookbackBars);
  let index = start;
  while (index < candles.length - 1) {
    const candle = candles[index];
    const previousHigh = Math.max(...candles.slice(index - params.lookbackBars, index).map((item) => item.high));
    const averageVolume = average(candles.slice(index - params.volumeLookbackBars, index).map((item) => item.volume));
    if (candle.close <= previousHigh || candle.volume < averageVolume) {
      index += 1;
      continue;
    }

    const entryRaw = candle.close;
    const entryPrice = roundPrice(entryRaw * (1 + params.slippageBps / 10_000));
    const quantity = roundQuantity(params.notional / entryPrice);
    const takeProfit = entryRaw * (1 + params.takeProfitPct);
    const stopLoss = entryRaw * (1 - params.stopLossPct);
    let exitIndex = Math.min(index + params.maxHoldingBars, candles.length - 1);
    let exitRaw = candles[exitIndex].close;
    for (let next = index + 1; next <= Math.min(index + params.maxHoldingBars, candles.length - 1); next += 1) {
      const nextCandle = candles[next];
      if (nextCandle.low <= stopLoss) {
        exitIndex = next;
        exitRaw = stopLoss;
        break;
      }
      if (nextCandle.high >= takeProfit) {
        exitIndex = next;
        exitRaw = takeProfit;
        break;
      }
    }
    const exitPrice = roundPrice(exitRaw * (1 - params.slippageBps / 10_000));
    const grossPnl = roundMoney((exitPrice - entryPrice) * quantity);
    const entryValue = entryPrice * quantity;
    const exitValue = exitPrice * quantity;
    const fees = roundMoney((entryValue + exitValue) * params.feeBps / 10_000);
    const slippageCost = roundMoney((entryRaw * quantity + exitRaw * quantity) * params.slippageBps / 10_000);
    const netPnl = roundMoney(grossPnl - fees);
    trades.push({
      symbol: candle.symbol,
      entryAt: new Date(candle.timestamp),
      exitAt: new Date(candles[exitIndex].timestamp),
      entryPrice,
      exitPrice,
      quantity,
      grossPnl,
      fees,
      slippageCost,
      netPnl,
      outcome: netPnl > 0 ? "win" : netPnl < 0 ? "loss" : "flat",
      holdingBars: exitIndex - index,
    });
    index = exitIndex + 1;
  }
  return trades;
}

function calculateBacktestMetrics(trades: SimulatedTrade[]): Omit<CreateStockBacktestRunInput, "symbol" | "timeframe" | "strategyTag" | "status" | "candleCount" | "tradeCount"> {
  const pnls = trades.map((trade) => trade.netPnl);
  const wins = pnls.filter((pnl) => pnl > 0);
  const losses = pnls.filter((pnl) => pnl < 0);
  const grossProfit = roundMoney(wins.reduce((sum, pnl) => sum + pnl, 0));
  const grossLoss = roundMoney(losses.reduce((sum, pnl) => sum + pnl, 0));
  const realizedPnl = roundMoney(pnls.reduce((sum, pnl) => sum + pnl, 0));
  return {
    winRate: pnls.length > 0 ? roundRatio(wins.length / pnls.length) : null,
    realizedPnl,
    grossProfit,
    grossLoss,
    averageProfit: wins.length > 0 ? roundMoney(grossProfit / wins.length) : null,
    averageLoss: losses.length > 0 ? roundMoney(grossLoss / losses.length) : null,
    expectancy: pnls.length > 0 ? roundMoney(realizedPnl / pnls.length) : null,
    profitFactor: grossLoss < 0 ? roundRatio(grossProfit / Math.abs(grossLoss)) : null,
    maximumDrawdown: calculateMaximumDrawdown(pnls),
  };
}

function calculateMaximumDrawdown(pnls: number[]): number {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const pnl of pnls) {
    equity += pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  return roundMoney(maxDrawdown);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function boundedNumber(value: number | undefined, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function boundedInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  return Math.round(boundedNumber(value, min, max, fallback));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundQuantity(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
