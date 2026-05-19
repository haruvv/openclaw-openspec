import {
  getStockMarketCandidate,
  updateStockMarketCandidateStatus,
} from "./repository.js";
import { processStockMarketSignal } from "./paper-runner.js";
import type { ProcessStockSignalResult, StockMarketCandidate, StockTradeAction } from "./types.js";

export interface ConvertStockMarketCandidateResult {
  candidate: StockMarketCandidate;
  result: ProcessStockSignalResult;
}

export async function convertStockMarketCandidateToPaperDecision(
  candidateId: string,
  options: { price?: number; suggestedAction?: StockTradeAction } = {},
): Promise<ConvertStockMarketCandidateResult> {
  const candidate = await getStockMarketCandidate(candidateId);
  if (!candidate) throw new Error("stock_candidate_not_found");
  const price = readPositiveNumber(candidate.rawPayload.price) ?? options.price;
  if (!price || !Number.isFinite(price) || price <= 0) throw new Error("candidate_price_required");
  const action = options.suggestedAction ?? (candidate.score >= 0.7 ? "BUY" : "WATCH");
  const result = await processStockMarketSignal({
    symbol: candidate.symbol,
    timeframe: "candidate",
    price,
    strategyTag: candidate.strategyTag ?? "market_scanner_candidate",
    suggestedAction: action,
    indicators: {
      candidateScore: candidate.score,
      candidateSource: candidate.source,
      theme: candidate.theme,
      sector: candidate.sector,
    },
    rawPayload: {
      source: "market_scanner_candidate",
      candidateId: candidate.id,
      candidateReason: candidate.reason,
      candidateStatus: candidate.status,
      price,
    },
  });
  return {
    candidate: await updateStockMarketCandidateStatus(candidate.id, "converted_to_decision", {
      convertedDecisionId: result.decision?.id,
    }),
    result,
  };
}

function readPositiveNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}
