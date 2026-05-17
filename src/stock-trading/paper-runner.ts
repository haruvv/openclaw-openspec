import type { Request, Response } from "express";
import { generateText } from "../utils/llm-provider.js";
import { logger } from "../utils/logger.js";
import { reviewCompletedPaperTrade } from "./trade-review.js";
import {
  attachStockDecisionLearningItems,
  applyPaperTradeWithLedger,
  createStockAiDecision,
  createStockMarketSignal,
  getStockPortfolioMetrics,
  listStockLearningItemsForDecisionContext,
  listStockResearchItems,
  parseConfidenceThreshold,
  parsePaperTradeNotional,
  updateStockMarketSignalOutcome,
  upsertStockMarketCandidate,
} from "./repository.js";
import type {
  CreateStockMarketSignalInput,
  ProcessStockSignalResult,
  StockMarketSignal,
  StockLearningItem,
  StockTradeAction,
} from "./types.js";

type JsonObject = Record<string, unknown>;
type DecisionPlan = {
  action: StockTradeAction;
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  takeProfitPrice?: number;
  stopLossPrice?: number;
  agents: Array<{
    agentName: string;
    score: number;
    stance: string;
    summary: string;
    reasoning: string;
  }>;
};
type AgentOpinion = DecisionPlan["agents"][number];

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;
const CANONICAL_STOCK_AGENTS = [
  "market-scanner",
  "fundamental",
  "news",
  "technical",
  "entry",
  "exit",
  "risk",
  "portfolio",
  "review-learning",
  "knowledge-curator",
  "judge",
] as const;
const STOCK_AGENT_SYSTEM_PROMPT = [
  "You are a paper-only stock trading decision committee.",
  "Return only JSON. Do not include markdown.",
  "Use only the provided signal, indicator, portfolio, and position facts.",
  "If fundamentals, news, filings, sector flow, or market index data are unavailable, state uncertainty instead of inventing facts.",
  "Return one opinion for every required agent. Do not omit agents.",
  "Risk Manager has veto power. This system never places real-money broker orders.",
].join("\n");

export async function handleTradingViewStockWebhook(req: Request, res: Response): Promise<void> {
  if (!isTradingViewWebhookAuthorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const size = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(size) && size > MAX_WEBHOOK_BODY_BYTES) {
    res.status(413).json({ error: "payload_too_large" });
    return;
  }

  const parsed = parseTradingViewSignalPayload(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const result = await processStockMarketSignal(parsed.signal);
  res.status(result.trade ? 201 : 202).json({
    signal: result.signal,
    decision: result.decision,
    trade: result.trade,
    learningItems: result.learningItems,
    portfolio: result.portfolio,
    position: result.position,
    status: result.status,
    message: result.message,
  });
}

export async function processStockMarketSignal(input: CreateStockMarketSignalInput): Promise<ProcessStockSignalResult> {
  let signal = await createStockMarketSignal({ ...input, status: "received" });
  if (signal.rawPayload.source !== "market_scanner_candidate") {
    await upsertStockMarketCandidate(buildCandidateFromSignal(signal));
  }
  const learningContext = await listStockLearningItemsForDecisionContext({
    symbol: signal.symbol,
    strategyTag: signal.strategyTag,
    limit: 8,
  });
  const decisionPlan = completeAgentMeeting(await buildDecisionPlan(signal, learningContext), signal);
  let decision = await createStockAiDecision({
    symbol: signal.symbol,
    finalAction: decisionPlan.action,
    confidence: decisionPlan.confidence,
    strategyTag: signal.strategyTag,
    reasoning: decisionPlan.reasoning,
    riskFactors: decisionPlan.riskFactors,
    takeProfitPrice: decisionPlan.takeProfitPrice,
    stopLossPrice: decisionPlan.stopLossPrice,
    agents: decisionPlan.agents,
  });
  decision = {
    ...decision,
    learningItems: await attachStockDecisionLearningItems(decision.id, learningContext.map((item) => item.id)),
  };

  const threshold = parseConfidenceThreshold();
  if (!isActionable(decision.finalAction)) {
    signal = await updateStockMarketSignalOutcome(signal.id, {
      status: "processed",
      decisionId: decision.id,
      statusReason: "decision_not_actionable",
    });
    return { signal, decision, status: signal.status, message: "Decision recorded without paper execution." };
  }

  if (decision.confidence < threshold) {
    signal = await updateStockMarketSignalOutcome(signal.id, {
      status: "blocked",
      decisionId: decision.id,
      statusReason: `confidence_below_threshold:${threshold}`,
    });
    return { signal, decision, status: signal.status, message: "Decision blocked by confidence threshold." };
  }

  const quantity = calculatePaperQuantity(signal.price);
  if (quantity <= 0) {
    signal = await updateStockMarketSignalOutcome(signal.id, {
      status: "blocked",
      decisionId: decision.id,
      statusReason: "paper_quantity_zero",
    });
    return { signal, decision, status: signal.status, message: "Decision blocked because paper quantity is zero." };
  }

  let ledger;
  try {
    ledger = await applyPaperTradeWithLedger({
      decisionId: decision.id,
      symbol: signal.symbol,
      side: decision.finalAction === "SELL" ? "sell" : "buy",
      quantity,
      price: signal.price,
      executionSource: "paper",
      rawExecution: {
        source: "tradingview_webhook",
        signalId: signal.id,
        sourceSignalId: signal.sourceSignalId,
        confidence: decision.confidence,
        paperOnly: true,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("paper_sell_exceeds_position:")) {
      signal = await updateStockMarketSignalOutcome(signal.id, {
        status: "blocked",
        decisionId: decision.id,
        statusReason: "paper_sell_exceeds_position",
      });
      return { signal, decision, status: signal.status, message: "Decision blocked because paper position is insufficient." };
    }
    throw error;
  }
  signal = await updateStockMarketSignalOutcome(signal.id, {
    status: "executed",
    decisionId: decision.id,
    tradeId: ledger.trade.id,
    statusReason: "paper_execution_created",
  });
  const learningItems = await reviewCompletedPaperTrade(ledger.trade);
  return {
    signal,
    decision,
    trade: ledger.trade,
    learningItems,
    portfolio: ledger.snapshot,
    position: ledger.position,
    status: signal.status,
    message: "Paper execution created.",
  };
}

function buildCandidateFromSignal(signal: StockMarketSignal) {
  return {
    symbol: signal.symbol,
    theme: readTextFromObject(signal.rawPayload, "theme") ?? readTextFromObject(signal.indicators, "theme"),
    sector: readTextFromObject(signal.rawPayload, "sector") ?? readTextFromObject(signal.indicators, "sector"),
    strategyTag: signal.strategyTag,
    reason: [
      "TradingView signal",
      signal.suggestedAction ? `action=${signal.suggestedAction}` : null,
      signal.strategyTag ? `strategy=${signal.strategyTag}` : null,
      `price=${signal.price}`,
    ].filter(Boolean).join(" / "),
    score: scoreSignalCandidate(signal),
    source: "tradingview" as const,
    sourceRefId: signal.id,
    rawPayload: {
      sourceSignalId: signal.sourceSignalId ?? null,
      timeframe: signal.timeframe,
      price: signal.price,
      suggestedAction: signal.suggestedAction ?? null,
      indicators: signal.indicators,
    },
    lastScannedAt: new Date(signal.receivedAt),
  };
}

function scoreSignalCandidate(signal: StockMarketSignal): number {
  let score = 0.52;
  if (signal.suggestedAction === "BUY") score += 0.16;
  if (signal.suggestedAction === "SELL") score += 0.08;
  if (signal.strategyTag) score += 0.04;
  if (typeof signal.volume === "number" && signal.volume > 0) score += 0.04;
  const rsi = numericIndicator(signal, "rsi");
  if (typeof rsi === "number" && rsi >= 45 && rsi <= 72) score += 0.04;
  if (typeof rsi === "number" && rsi >= 82) score -= 0.08;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

function readTextFromObject(value: Record<string, unknown>, key: string): string | undefined {
  const raw = value[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
}

async function buildDecisionPlan(signal: StockMarketSignal, learningContext: StockLearningItem[]): Promise<DecisionPlan> {
  const fallback = () => buildDeterministicPaperDecision(signal);
  if (!shouldUseLlmDecision()) return fallback();

  try {
    const portfolio = await getStockPortfolioMetrics();
    const research = await listStockResearchItems({ symbol: signal.symbol, includeMarketWide: true, limit: 8 });
    const raw = await generateText(JSON.stringify(buildLlmDecisionPayload(signal, portfolio, research, learningContext), null, 2), STOCK_AGENT_SYSTEM_PROMPT);
    return enforceRiskVeto(parseLlmDecisionPlan(raw), signal);
  } catch (error) {
    logger.warn("Stock LLM decision failed; falling back to deterministic paper decision", {
      symbol: signal.symbol,
      reason: error instanceof Error ? error.message : String(error),
    });
    return fallback();
  }
}

function isTradingViewWebhookAuthorized(req: Request): boolean {
  const expected = process.env.TRADINGVIEW_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  const candidates = [
    req.headers["x-tradingview-secret"],
    req.headers.authorization,
    typeof req.body?.secret === "string" ? req.body.secret : undefined,
  ];
  return candidates.some((candidate) => {
    if (Array.isArray(candidate)) return candidate.includes(expected) || candidate.includes(`Bearer ${expected}`);
    return candidate === expected || candidate === `Bearer ${expected}`;
  });
}

export function parseTradingViewSignalPayload(payload: unknown): { ok: true; signal: CreateStockMarketSignalInput } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, error: "invalid_payload" };
  const body = payload as JsonObject;
  const symbol = readString(body, ["symbol", "ticker", "syminfo.ticker"]);
  if (!symbol) return { ok: false, error: "symbol_required" };
  const price = readNumber(body, ["price", "close", "c"]);
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return { ok: false, error: "valid_price_required" };
  const normalizedPrice = price;
  const timeframe = readString(body, ["timeframe", "interval", "tf"]) ?? "unknown";
  const suggestedAction = normalizeAction(readString(body, ["action", "signal", "side"]));
  const indicators = readObject(body, "indicators") ?? collectKnownIndicators(body);
  const rawPayload = sanitizePayload(body);

  return {
    ok: true,
    signal: {
      source: "tradingview",
      sourceSignalId: readString(body, ["id", "alert_id", "alertId"]),
      symbol: symbol.toUpperCase(),
      timeframe,
      price: normalizedPrice,
      open: readNumber(body, ["open", "o"]),
      high: readNumber(body, ["high", "h"]),
      low: readNumber(body, ["low", "l"]),
      close: readNumber(body, ["close", "c"]) ?? normalizedPrice,
      volume: readNumber(body, ["volume", "v"]),
      strategyTag: readString(body, ["strategy", "strategyTag", "strategy_tag"]),
      suggestedAction,
      indicators,
      rawPayload,
    },
  };
}

function buildDeterministicPaperDecision(signal: StockMarketSignal): DecisionPlan {
  const rsi = numericIndicator(signal, "rsi");
  const ema20 = numericIndicator(signal, "ema20") ?? numericIndicator(signal, "ema_20");
  const ema50 = numericIndicator(signal, "ema50") ?? numericIndicator(signal, "ema_50");
  const suggested = signal.suggestedAction;
  let action: StockTradeAction = suggested && suggested !== "HOLD" ? suggested : "WATCH";
  let confidence = 0.58;
  const riskFactors: string[] = [];
  const bullishTrend = ema20 !== null && signal.price > ema20 && (ema50 === null || ema20 >= ema50);
  const bearishTrend = ema20 !== null && signal.price < ema20 && (ema50 === null || ema20 <= ema50);

  if (!suggested) {
    if (bullishTrend && (rsi === null || (rsi >= 45 && rsi <= 72))) action = "BUY";
    else if (bearishTrend && rsi !== null && rsi <= 45) action = "SELL";
  }

  if (action === "BUY" && bullishTrend) confidence += 0.16;
  if (action === "SELL" && bearishTrend) confidence += 0.16;
  if (rsi !== null && rsi > 75) {
    confidence -= 0.18;
    riskFactors.push("RSIが過熱圏です。");
  }
  if (rsi !== null && rsi < 25) {
    confidence -= 0.12;
    riskFactors.push("RSIが売られすぎで反発・だましの可能性があります。");
  }
  if (!signal.strategyTag) riskFactors.push("戦略タグが未指定です。");
  confidence = clamp(confidence, 0.05, 0.92);

  const stopLossPrice = action === "BUY" ? roundPrice(signal.price * 0.97) : action === "SELL" ? roundPrice(signal.price * 1.03) : undefined;
  const takeProfitPrice = action === "BUY" ? roundPrice(signal.price * 1.06) : action === "SELL" ? roundPrice(signal.price * 0.94) : undefined;
  const reasoning = [
    `${signal.source} signal ${signal.symbol} ${signal.timeframe} @ ${signal.price}.`,
    action === "WATCH" ? "条件が弱いため監視に留めます。" : `${action}を内部ペーパー判断として記録します。`,
    bullishTrend ? "短期トレンドは上向きです。" : bearishTrend ? "短期トレンドは下向きです。" : "トレンド判定は限定的です。",
  ].join(" ");

  return {
    action,
    confidence,
    reasoning,
    riskFactors,
    takeProfitPrice,
    stopLossPrice,
    agents: [
      {
        agentName: "market-signal",
        score: Math.round(confidence * 100),
        stance: action.toLowerCase(),
        summary: `${signal.timeframe} signal resolved to ${action}`,
        reasoning,
      },
      {
        agentName: "risk",
        score: Math.round((1 - riskFactors.length * 0.18) * 100),
        stance: riskFactors.length > 0 ? "caution" : "approve",
        summary: riskFactors.length > 0 ? "リスク条件あり" : "主要なブロック条件なし",
        reasoning: riskFactors.join(" ") || "paper-only sizing and confidence threshold are applied.",
      },
    ],
  };
}

function shouldUseLlmDecision(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = (env.STOCK_AI_DECISION_MODE ?? "auto").toLowerCase();
  if (mode === "deterministic") return false;
  if (mode === "llm") return true;
  return Boolean(env.GEMINI_API_KEY || env.ZAI_API_KEY);
}

function buildLlmDecisionPayload(
  signal: StockMarketSignal,
  portfolio: Awaited<ReturnType<typeof getStockPortfolioMetrics>>,
  research: Awaited<ReturnType<typeof listStockResearchItems>>,
  learningContext: StockLearningItem[],
) {
  return {
    instruction: "Return JSON matching outputSchema. Make a paper-trading decision for a swing-trading system. Do not recommend real-money trading.",
    availableContext: {
      marketSignal: {
        source: signal.source,
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        price: signal.price,
        open: signal.open ?? null,
        high: signal.high ?? null,
        low: signal.low ?? null,
        close: signal.close ?? null,
        volume: signal.volume ?? null,
        strategyTag: signal.strategyTag ?? null,
        suggestedAction: signal.suggestedAction ?? null,
        indicators: signal.indicators,
        receivedAt: signal.receivedAt,
      },
      paperPortfolio: {
        initialCapital: portfolio.initialCapital,
        currentEquity: portfolio.currentEquity,
        cashBalance: portfolio.cashBalance,
        realizedPnl: portfolio.realizedPnl,
        unrealizedPnl: portfolio.unrealizedPnl,
        winRate: portfolio.winRate,
        maximumDrawdown: portfolio.maximumDrawdown,
        openPositions: portfolio.positions.map((position) => ({
          symbol: position.symbol,
          quantity: position.quantity,
          averageEntryPrice: position.averageEntryPrice,
          lastMarkPrice: position.lastMarkPrice,
          marketValue: position.marketValue,
          unrealizedPnl: position.unrealizedPnl,
          realizedPnl: position.realizedPnl,
        })),
      },
      researchContext: research.map((item) => ({
        symbol: item.symbol ?? "market-wide",
        category: item.category,
        title: item.title,
        summary: item.summary,
        source: item.source,
        sourceUrl: item.sourceUrl ?? null,
        sentiment: item.sentiment,
        importance: item.importance,
        publishedAt: item.publishedAt,
      })),
      learningContext: {
        framing: "Historical internal paper-trade observations only. Use them as prior lessons, not as current market facts.",
        items: learningContext.map((item) => ({
          id: item.id,
          sourceTradeId: item.sourceTradeId ?? null,
          category: item.category,
          title: item.title,
          body: item.body,
          confidence: item.confidence,
          appliedToSkill: item.appliedToSkill,
          createdAt: item.createdAt,
        })),
      },
      unavailableContext: [
        ...(research.length > 0
          ? ["live index breadth", "order book", "unprovided provider-specific raw fundamentals"]
          : [
          "fundamental statements",
          "earnings releases",
          "news articles",
          "TDnet/EDINET filings",
          "sector flow",
          "index breadth",
          "order book",
        ]),
        ...(learningContext.length > 0 ? [] : ["prior paper-trade lessons"]),
      ],
    },
    requiredAgents: [
      "market-scanner",
      "fundamental",
      "news",
      "technical",
      "entry",
      "exit",
      "risk",
      "portfolio",
      "review-learning",
      "knowledge-curator",
      "judge",
    ],
    riskPolicy: {
      riskAgentRejectVetoesExecution: true,
      maxActionWithoutEvidence: "WATCH",
      paperOnly: true,
    },
    outputSchema: {
      finalAction: "BUY | SELL | HOLD | WATCH | SKIP",
      confidence: "number 0..1",
      reasoning: "string",
      riskFactors: ["string"],
      takeProfitPrice: "number | null",
      stopLossPrice: "number | null",
      agents: [{
        agentName: "market-scanner | fundamental | news | technical | entry | exit | risk | portfolio | review-learning | knowledge-curator | judge",
        score: "number 0..100",
        stance: "string",
        summary: "string",
        reasoning: "string",
      }],
    },
  };
}

function parseLlmDecisionPlan(text: string): DecisionPlan {
  const value = JSON.parse(extractJsonObject(text)) as unknown;
  if (!value || typeof value !== "object") throw new Error("llm_decision_not_object");
  const object = value as JsonObject;
  const action = normalizeAction(typeof object.finalAction === "string" ? object.finalAction : undefined);
  if (!action) throw new Error("llm_decision_invalid_action");
  const confidence = readBoundedNumber(object.confidence, 0, 1, "llm_decision_invalid_confidence");
  const reasoning = readRequiredText(object.reasoning, "llm_decision_reasoning_required");
  const agents = parseLlmAgents(object.agents);
  return {
    action,
    confidence,
    reasoning,
    riskFactors: parseStringList(object.riskFactors),
    takeProfitPrice: parseOptionalPositiveNumber(object.takeProfitPrice),
    stopLossPrice: parseOptionalPositiveNumber(object.stopLossPrice),
    agents,
  };
}

function parseLlmAgents(value: unknown): DecisionPlan["agents"] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("llm_decision_agents_required");
  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`llm_decision_agent_invalid:${index}`);
    const object = item as JsonObject;
    return {
      agentName: readRequiredText(object.agentName, `llm_decision_agent_name_required:${index}`),
      score: Math.round(readBoundedNumber(object.score, 0, 100, `llm_decision_agent_score_invalid:${index}`)),
      stance: readRequiredText(object.stance, `llm_decision_agent_stance_required:${index}`),
      summary: readRequiredText(object.summary, `llm_decision_agent_summary_required:${index}`),
      reasoning: readRequiredText(object.reasoning, `llm_decision_agent_reasoning_required:${index}`),
    };
  });
}

function completeAgentMeeting(plan: DecisionPlan, signal: StockMarketSignal): DecisionPlan {
  const byKey = new Map<string, AgentOpinion>();
  for (const agent of plan.agents) {
    byKey.set(normalizeAgentName(agent.agentName), agent);
  }
  return {
    ...plan,
    agents: CANONICAL_STOCK_AGENTS.map((name) => {
      const existing = byKey.get(name);
      return existing ? { ...existing, agentName: name } : buildFallbackAgentOpinion(name, plan, signal);
    }),
  };
}

function normalizeAgentName(value: string): string {
  const normalized = value.toLowerCase().replace(/[_\s]+/g, "-");
  if (normalized.includes("market")) return "market-scanner";
  if (normalized.includes("fundamental")) return "fundamental";
  if (normalized.includes("news")) return "news";
  if (normalized.includes("technical")) return "technical";
  if (normalized.includes("entry")) return "entry";
  if (normalized.includes("exit")) return "exit";
  if (normalized.includes("risk")) return "risk";
  if (normalized.includes("portfolio")) return "portfolio";
  if (normalized.includes("review") || normalized.includes("learning")) return "review-learning";
  if (normalized.includes("knowledge") || normalized.includes("curator")) return "knowledge-curator";
  if (normalized.includes("judge")) return "judge";
  return normalized;
}

function buildFallbackAgentOpinion(agentName: typeof CANONICAL_STOCK_AGENTS[number], plan: DecisionPlan, signal: StockMarketSignal): AgentOpinion {
  const rsi = numericIndicator(signal, "rsi");
  const volume = typeof signal.volume === "number" ? signal.volume : null;
  const baseScore = Math.round(plan.confidence * 100);
  const fallback: Record<typeof CANONICAL_STOCK_AGENTS[number], AgentOpinion> = {
    "market-scanner": {
      agentName,
      score: 50,
      stance: "uncertain",
      summary: "市場全体データは未連携",
      reasoning: "指数、セクター資金流入、地合いデータはこのシグナルには含まれていません。",
    },
    fundamental: {
      agentName,
      score: 50,
      stance: "uncertain",
      summary: "ファンダ情報は限定的",
      reasoning: "決算、PER/PBR、業績予想などはリサーチ材料がない限り不明として扱います。",
    },
    news: {
      agentName,
      score: 50,
      stance: "uncertain",
      summary: "ニュース材料は限定的",
      reasoning: "ニュース、開示、政策テーマは保存済みリサーチがない限り判断材料にしていません。",
    },
    technical: {
      agentName,
      score: baseScore,
      stance: plan.action === "BUY" ? "bullish" : plan.action === "SELL" ? "bearish" : "wait",
      summary: `${signal.timeframe}チャートシグナルを評価`,
      reasoning: `価格 ${signal.price}、RSI ${rsi ?? "unknown"}、出来高 ${volume ?? "unknown"} をもとに ${plan.action} 判断を補助します。`,
    },
    entry: {
      agentName,
      score: isActionable(plan.action) ? baseScore : 45,
      stance: plan.action === "BUY" ? "enter-long" : plan.action === "SELL" ? "exit-or-sell" : "wait",
      summary: isActionable(plan.action) ? "エントリー条件は紙取引候補" : "エントリー見送り",
      reasoning: isActionable(plan.action) ? "TradingViewシグナルと信頼度が紙取引候補として扱われます。" : "最終判断が実行対象ではないためエントリーしません。",
    },
    exit: {
      agentName,
      score: plan.takeProfitPrice || plan.stopLossPrice ? 70 : 50,
      stance: "planned",
      summary: "利確/損切り条件を確認",
      reasoning: `takeProfit=${plan.takeProfitPrice ?? "unset"} stopLoss=${plan.stopLossPrice ?? "unset"}。`,
    },
    risk: {
      agentName,
      score: Math.max(0, Math.round((1 - plan.riskFactors.length * 0.18) * 100)),
      stance: plan.riskFactors.some((risk) => risk.toLowerCase().includes("veto")) ? "reject" : plan.riskFactors.length > 0 ? "caution" : "approve",
      summary: plan.riskFactors.length > 0 ? "リスク条件あり" : "主要なブロック条件なし",
      reasoning: plan.riskFactors.join(" ") || "confidence gate、ledger check、paper-only制約を適用します。",
    },
    portfolio: {
      agentName,
      score: 70,
      stance: "paper-ok",
      summary: "紙取引ポートフォリオ内で評価",
      reasoning: "実口座ではなく内部ペーパー残高・建玉だけを前提に判断します。",
    },
    "review-learning": {
      agentName,
      score: 55,
      stance: "observe",
      summary: "決済後レビュー待ち",
      reasoning: "この時点では未来の結果を使わず、SELL後の実現損益で学習ログを作成します。",
    },
    "knowledge-curator": {
      agentName,
      score: 55,
      stance: "observe",
      summary: "知識化候補を待機",
      reasoning: "取引結果とレビューが出た後に、勝ち/負けパターンや禁止ルール候補として蓄積します。",
    },
    judge: {
      agentName,
      score: baseScore,
      stance: plan.action.toLowerCase(),
      summary: `${plan.action}を最終判断`,
      reasoning: plan.reasoning,
    },
  };
  return fallback[agentName];
}

function enforceRiskVeto(plan: DecisionPlan, signal: StockMarketSignal): DecisionPlan {
  const riskAgent = plan.agents.find((agent) => agent.agentName.toLowerCase().includes("risk"));
  const riskRejected = riskAgent?.stance.toLowerCase().includes("reject") ?? false;
  if (!riskRejected || !isActionable(plan.action)) return plan;
  return {
    ...plan,
    action: "WATCH",
    confidence: Math.min(plan.confidence, 0.69),
    reasoning: `${plan.reasoning} Risk Manager veto applied; paper execution blocked for ${signal.symbol}.`,
    riskFactors: [...plan.riskFactors, `Risk Manager veto: ${riskAgent?.summary ?? "reject"}`],
  };
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("llm_decision_json_not_found");
}

function readRequiredText(value: unknown, error: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(error);
  return value.trim();
}

function readBoundedNumber(value: unknown, min: number, max: number, error: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(error);
  return number;
}

function parseOptionalPositiveNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function parseStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function calculatePaperQuantity(price: number): number {
  const notional = parsePaperTradeNotional();
  return Math.floor((notional / price) * 1000) / 1000;
}

function isActionable(action: StockTradeAction): boolean {
  return action === "BUY" || action === "SELL";
}

function normalizeAction(value?: string): StockTradeAction | undefined {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "BUY" || normalized === "SELL" || normalized === "HOLD" || normalized === "WATCH" || normalized === "SKIP") return normalized;
  if (normalized === "LONG") return "BUY";
  if (normalized === "SHORT") return "SELL";
  return undefined;
}

function readString(body: JsonObject, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readNumber(body: JsonObject, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = body[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function readObject(body: JsonObject, key: string): JsonObject | undefined {
  const value = body[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function collectKnownIndicators(body: JsonObject): JsonObject {
  const indicators: JsonObject = {};
  for (const key of ["rsi", "ema20", "ema50", "sma20", "sma50", "macd", "atr", "volumeRatio"]) {
    if (body[key] !== undefined) indicators[key] = body[key];
  }
  return indicators;
}

function numericIndicator(signal: StockMarketSignal, key: string): number | null {
  const value = signal.indicators[key];
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function sanitizePayload(body: JsonObject): JsonObject {
  const sanitized: JsonObject = {};
  const sensitiveKeys = new Set(["secret", "passphrase", "token", "auth", "authorization", "apikey", "api_key"]);
  for (const [key, value] of Object.entries(body)) {
    if (sensitiveKeys.has(key.toLowerCase())) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
