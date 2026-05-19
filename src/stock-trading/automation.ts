import { convertStockMarketCandidateToPaperDecision } from "./candidate-converter.js";
import { runStockMarketDataCollector } from "./market-data-collector.js";
import { scanStockMarketDataCandidates } from "./market-data-scanner.js";
import { listStockMarketCandidates } from "./repository.js";
import type {
  ProcessStockSignalResult,
  StockMarketCandidate,
  StockMarketDataCollectionRun,
} from "./types.js";

export interface StockPaperCycleConversionSummary {
  candidateId: string;
  symbol: string;
  candidateScore: number;
  decisionId?: string;
  finalAction?: string;
  tradeId?: string;
  status: ProcessStockSignalResult["status"];
  message: string;
}

export interface StockPaperCycleErrorSummary {
  candidateId?: string;
  symbol?: string;
  error: string;
}

export interface StockPaperCycleResult {
  status: "completed" | "partial" | "failed";
  collectionRun: StockMarketDataCollectionRun;
  scan: {
    scannedEntries: number;
    createdCandidates: number;
    skippedEntries: number;
  };
  threshold: number;
  candidateLimit: number;
  eligibleCandidates: number;
  convertedCount: number;
  skippedCount: number;
  errorCount: number;
  conversions: StockPaperCycleConversionSummary[];
  errors: StockPaperCycleErrorSummary[];
}

export async function runStockAutonomousPaperCycle(options: {
  env?: NodeJS.ProcessEnv;
  threshold?: number;
  candidateLimit?: number;
} = {}): Promise<StockPaperCycleResult> {
  const env = options.env ?? process.env;
  const threshold = options.threshold ?? parseAutoCandidateThreshold(env);
  const candidateLimit = options.candidateLimit ?? parseAutoCandidateLimit(env);
  const collectionRun = await runStockMarketDataCollector({ env });
  const errors: StockPaperCycleErrorSummary[] = [];

  if (collectionRun.status === "failed") {
    errors.push({ error: collectionRun.error ?? "stock_market_data_collection_failed" });
  }

  const scan = collectionRun.status === "completed"
    ? await scanStockMarketDataCandidates()
    : { scannedEntries: 0, createdCandidates: 0, skippedEntries: 0, candidates: [] };

  const eligible = collectionRun.status === "completed"
    ? await listEligibleProviderCandidates(threshold, candidateLimit)
    : [];
  const conversions: StockPaperCycleConversionSummary[] = [];
  for (const candidate of eligible) {
    try {
      const converted = await convertStockMarketCandidateToPaperDecision(candidate.id);
      conversions.push({
        candidateId: converted.candidate.id,
        symbol: converted.candidate.symbol,
        candidateScore: converted.candidate.score,
        decisionId: converted.result.decision?.id,
        finalAction: converted.result.decision?.finalAction,
        tradeId: converted.result.trade?.id,
        status: converted.result.status,
        message: converted.result.message,
      });
    } catch (error) {
      errors.push({
        candidateId: candidate.id,
        symbol: candidate.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const status = collectionRun.status === "failed" && conversions.length === 0
    ? "failed"
    : errors.length > 0
      ? "partial"
      : "completed";
  return {
    status,
    collectionRun,
    scan: {
      scannedEntries: scan.scannedEntries,
      createdCandidates: scan.createdCandidates,
      skippedEntries: scan.skippedEntries,
    },
    threshold,
    candidateLimit,
    eligibleCandidates: eligible.length,
    convertedCount: conversions.length,
    skippedCount: Math.max(0, scan.createdCandidates - eligible.length) + scan.skippedEntries,
    errorCount: errors.length,
    conversions,
    errors,
  };
}

function parseAutoCandidateThreshold(env: NodeJS.ProcessEnv): number {
  const value = Number(env.STOCK_TRADING_AUTO_CANDIDATE_THRESHOLD ?? 0.7);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.7;
}

function parseAutoCandidateLimit(env: NodeJS.ProcessEnv): number {
  const value = Number(env.STOCK_TRADING_AUTO_CANDIDATE_LIMIT ?? 5);
  return Number.isFinite(value) && value > 0 ? Math.min(20, Math.floor(value)) : 5;
}

async function listEligibleProviderCandidates(threshold: number, limit: number): Promise<StockMarketCandidate[]> {
  const candidates = await listStockMarketCandidates({ status: "watch", limit: 500 });
  return candidates
    .filter((candidate) => candidate.source === "provider" && candidate.score >= threshold)
    .slice(0, limit);
}
