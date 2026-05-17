import {
  listStockCandles,
  listStockMarketDataWatchlistEntries,
  upsertStockMarketCandidate,
} from "./repository.js";
import type { StockMarketCandidate } from "./types.js";

export interface StockMarketDataScanResult {
  scannedEntries: number;
  createdCandidates: number;
  skippedEntries: number;
  candidates: StockMarketCandidate[];
}

const BREAKOUT_LOOKBACK = 5;
const VOLUME_LOOKBACK = 5;
const MIN_VOLUME_EXPANSION = 1.2;

export async function scanStockMarketDataCandidates(): Promise<StockMarketDataScanResult> {
  const entries = await listStockMarketDataWatchlistEntries({ enabled: true, limit: 200 });
  const candidates: StockMarketCandidate[] = [];
  let skippedEntries = 0;
  for (const entry of entries) {
    const candles = await listStockCandles({ symbol: entry.symbol, timeframe: entry.timeframe, limit: 5000 });
    const candidateInput = buildCandidateFromCandles(entry, candles.slice(-Math.max(BREAKOUT_LOOKBACK, VOLUME_LOOKBACK) - 1));
    if (!candidateInput) {
      skippedEntries += 1;
      continue;
    }
    candidates.push(await upsertStockMarketCandidate(candidateInput));
  }
  return {
    scannedEntries: entries.length,
    createdCandidates: candidates.length,
    skippedEntries,
    candidates,
  };
}

function buildCandidateFromCandles(
  entry: { symbol: string; timeframe: string; provider: string },
  candles: Array<{ high: number; close: number; volume: number; timestamp: string }>,
): Parameters<typeof upsertStockMarketCandidate>[0] | null {
  const requiredCandles = Math.max(BREAKOUT_LOOKBACK, VOLUME_LOOKBACK) + 1;
  if (candles.length < requiredCandles) return null;
  const latest = candles[candles.length - 1];
  const previous = candles.slice(0, -1);
  const previousHigh = Math.max(...previous.slice(-BREAKOUT_LOOKBACK).map((candle) => candle.high));
  const averageVolume = average(previous.slice(-VOLUME_LOOKBACK).map((candle) => candle.volume));
  if (latest.close <= previousHigh || latest.volume < averageVolume * MIN_VOLUME_EXPANSION) return null;
  const breakoutPct = previousHigh > 0 ? (latest.close - previousHigh) / previousHigh : 0;
  const volumeRatio = averageVolume > 0 ? latest.volume / averageVolume : 1;
  const score = clamp(0.55 + breakoutPct * 8 + Math.min(volumeRatio - 1, 2) * 0.15, 0.5, 0.95);
  return {
    symbol: entry.symbol,
    strategyTag: "breakout_momentum",
    reason: `Provider Market Scanner: ${entry.timeframe} close broke ${BREAKOUT_LOOKBACK}-bar high with ${volumeRatio.toFixed(2)}x volume`,
    score,
    source: "provider",
    status: "watch",
    rawPayload: {
      provider: entry.provider,
      timeframe: entry.timeframe,
      price: latest.close,
      previousHigh,
      latestVolume: latest.volume,
      averageVolume,
      volumeRatio,
      breakoutPct,
      latestCandleAt: latest.timestamp,
    },
    lastScannedAt: new Date(),
  };
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
