import {
  createStockLearningItem,
  getStockAiDecisionDetail,
  listStockLearningItemsBySourceTrade,
  listStockResearchItems,
} from "./repository.js";
import type {
  CreateStockLearningItemInput,
  StockAiDecisionDetail,
  StockLearningCategory,
  StockLearningItem,
  StockResearchItem,
  StockTrade,
} from "./types.js";

type LearningDraft = Pick<CreateStockLearningItemInput, "id" | "category" | "title" | "body" | "confidence">;

export async function reviewCompletedPaperTrade(trade: StockTrade): Promise<StockLearningItem[]> {
  if (!shouldReviewTrade(trade)) return [];

  const existing = await listStockLearningItemsBySourceTrade(trade.id);
  if (existing.length > 0) return existing;

  const [decision, research] = await Promise.all([
    trade.decisionId ? getStockAiDecisionDetail(trade.decisionId) : Promise.resolve(null),
    listStockResearchItems({ symbol: trade.symbol, includeMarketWide: true, limit: 5 }),
  ]);
  const drafts = buildTradeReviewLearningDrafts(trade, decision, research);
  const created: StockLearningItem[] = [];
  for (const draft of drafts) {
    created.push(await createStockLearningItem({
      ...draft,
      sourceTradeId: trade.id,
      appliedToSkill: false,
    }));
  }
  return created;
}

function shouldReviewTrade(trade: StockTrade): boolean {
  return trade.executionSource === "paper"
    && trade.side === "sell"
    && typeof trade.realizedPnl === "number"
    && trade.outcome !== "open";
}

function buildTradeReviewLearningDrafts(
  trade: StockTrade,
  decision: StockAiDecisionDetail | null,
  research: StockResearchItem[],
): LearningDraft[] {
  const outcomeCategory = categoryForOutcome(trade);
  const outcomeLabel = labelForOutcome(trade);
  const confidence = confidenceForTrade(trade, decision);
  const context = buildReviewContext(trade, decision, research);
  const drafts: LearningDraft[] = [{
    id: learningId(trade.id, "outcome"),
    category: outcomeCategory,
    title: `${trade.symbol} ${outcomeLabel}: ${formatSignedMoney(trade.realizedPnl ?? 0)}`,
    body: [
      `実現損益 ${formatSignedMoney(trade.realizedPnl ?? 0)} の内部ペーパーSELLをレビューしました。`,
      context,
    ].filter(Boolean).join("\n\n"),
    confidence,
  }];

  drafts.push({
    id: learningId(trade.id, trade.outcome === "loss" ? "rule" : "strategy"),
    category: followUpCategoryForOutcome(trade, decision),
    title: followUpTitleForOutcome(trade, decision),
    body: buildFollowUpBody(trade, decision, research),
    confidence: Math.max(0.45, Math.min(0.9, confidence - 0.05)),
  });

  return drafts;
}

function buildReviewContext(
  trade: StockTrade,
  decision: StockAiDecisionDetail | null,
  research: StockResearchItem[],
): string {
  const parts = [
    `取引: ${trade.symbol} ${trade.quantity}株 @ ${formatMoney(trade.price)} / outcome=${trade.outcome ?? "unknown"}。`,
  ];
  if (decision) {
    parts.push([
      `AI判断: ${decision.finalAction} confidence=${formatPercent(decision.confidence)}`,
      decision.strategyTag ? `strategy=${decision.strategyTag}` : null,
      `reason=${decision.reasoning}`,
      `risk=${decision.riskFactors.length > 0 ? decision.riskFactors.join(" / ") : "none"}`,
    ].filter(Boolean).join(" / "));
    if (decision.agents.length > 0) {
      parts.push(`Agent意見: ${decision.agents.map((agent) => `${agent.agentName}:${agent.stance}(${Math.round(agent.score)})`).join(" / ")}`);
    }
  }
  if (research.length > 0) {
    parts.push(`参照リサーチ: ${research.map((item) => `${item.symbol ?? "market"}:${item.category}:${item.title}`).join(" / ")}`);
  }
  return parts.join("\n");
}

function buildFollowUpBody(
  trade: StockTrade,
  decision: StockAiDecisionDetail | null,
  research: StockResearchItem[],
): string {
  const lines = [buildReviewContext(trade, decision, research)];
  if (trade.outcome === "win") {
    lines.push("次回も同じ戦略タグ、リスク条件、材料の鮮度を確認し、利確幅と損切り幅の事前設定を維持します。");
  } else if (trade.outcome === "loss") {
    lines.push("次回はエントリー前にRisk Agentの懸念、損切り距離、過熱感、材料の織り込み済みリスクをより強く確認します。");
  } else {
    lines.push("損益が限定的だったため、エントリー根拠と保有時間が期待値に見合ったかを次回判断に残します。");
  }
  return lines.join("\n\n");
}

function categoryForOutcome(trade: StockTrade): StockLearningCategory {
  if (trade.outcome === "win") return "winning_pattern";
  if (trade.outcome === "loss") return "losing_pattern";
  return "strategy_note";
}

function followUpCategoryForOutcome(trade: StockTrade, decision: StockAiDecisionDetail | null): StockLearningCategory {
  if (trade.outcome === "loss" && (decision?.riskFactors.length ?? 0) > 0) return "blocked_pattern";
  if (trade.outcome === "loss") return "rule_candidate";
  return "strategy_note";
}

function followUpTitleForOutcome(trade: StockTrade, decision: StockAiDecisionDetail | null): string {
  if (trade.outcome === "loss" && (decision?.riskFactors.length ?? 0) > 0) return `${trade.symbol} 損失レビュー: リスク条件を次回ブロック候補にする`;
  if (trade.outcome === "loss") return `${trade.symbol} 損失レビュー: エントリー条件を見直す`;
  if (trade.outcome === "win") return `${trade.symbol} 勝ちレビュー: 再現条件を保存する`;
  return `${trade.symbol} フラットレビュー: 期待値を再確認する`;
}

function labelForOutcome(trade: StockTrade): string {
  if (trade.outcome === "win") return "勝ちレビュー";
  if (trade.outcome === "loss") return "負けレビュー";
  return "フラットレビュー";
}

function confidenceForTrade(trade: StockTrade, decision: StockAiDecisionDetail | null): number {
  const decisionConfidence = decision?.confidence ?? 0.55;
  const outcomeAdjustment = trade.outcome === "flat" ? -0.1 : 0.05;
  return Math.max(0.4, Math.min(0.95, decisionConfidence + outcomeAdjustment));
}

function learningId(tradeId: string, slot: string): string {
  return `stock-trade-review-${tradeId}-${slot}`;
}

function formatMoney(value: number): string {
  return `${Math.round(value * 100) / 100}`;
}

function formatSignedMoney(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatMoney(value)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
